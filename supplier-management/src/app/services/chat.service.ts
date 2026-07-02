import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { CryptoService, CHAT_ENCRYPTED_FIELDS } from './crypto.service';

export interface ChatUser {
  id: number;
  name: string;
  avatar: string;
  role: string;
  online: boolean;
  color: string;
  isAgent?: boolean;
}

export interface ChatMessage {
  id: number;
  conversationId: string;
  senderId: number;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: Date;
  pending?: boolean;
}

export interface Conversation {
  id: string;
  type: 'channel' | 'direct';
  name: string;
  icon?: string;
  participants: number[];
}

export const HELPDESK_AGENT: ChatUser = {
  id:      0,
  name:    'Soporte Dairi',
  avatar:  '🎧',
  role:    'Agente de Helpdesk',
  online:  true,
  color:   '#6366f1',
  isAgent: true,
};

export const HELPDESK_CONV_ID = 'dm-helpdesk';
export const HELPDESK_MAX_CHARS = 500;

const HELPDESK_AUTO_REPLY =
  '✓ Tu mensaje fue recibido. Un agente de soporte revisará tu consulta y te contactará a la brevedad.\n\nHorario de atención: Lunes a Viernes, 9:00 – 18:00 hrs.';

let _msgSeq = -1;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http   = inject(HttpClient);
  private auth   = inject(AuthService);
  private crypto = inject(CryptoService);

  readonly channels: Conversation[] = [
    { id: 'ch-general',  type: 'channel', name: 'general',  icon: '#',  participants: [] },
    { id: 'ch-anuncios', type: 'channel', name: 'anuncios', icon: '📢', participants: [] },
    { id: 'ch-clinica',  type: 'channel', name: 'clínica',  icon: '🏥', participants: [] },
  ];

  readonly allUsers: ChatUser[] = [];

  constructor() {
    this.http.get<ChatUser[]>('/api/chat/users').subscribe({
      next: users => this.allUsers.splice(0, this.allUsers.length, ...users)
    });
    // Seed helpdesk conversation with welcome message
    const helpdesk = this._ensureSignal(HELPDESK_CONV_ID);
    if (helpdesk().length === 0) {
      helpdesk.set([{
        id: _msgSeq--,
        conversationId: HELPDESK_CONV_ID,
        senderId:    HELPDESK_AGENT.id,
        senderName:  HELPDESK_AGENT.name,
        senderAvatar:HELPDESK_AGENT.avatar,
        content:     '¡Hola! Soy el agente de soporte de Dairi. ¿En qué puedo ayudarte?\n\nPuedes enviarme mensajes de hasta 500 caracteres describiendo tu consulta.',
        timestamp:   new Date(),
      }]);
    }
  }

  private _messages = new Map<string, ReturnType<typeof signal<ChatMessage[]>>>();
  private _lastRead  = new Map<string, number>();

  getContacts(): ChatUser[] {
    const me = this.auth.user();
    const peers = this.allUsers.filter(u => u.id !== me?.id);
    return [HELPDESK_AGENT, ...peers];
  }

  getDMId(otherUserId: number): string {
    if (otherUserId === HELPDESK_AGENT.id) return HELPDESK_CONV_ID;
    const me = this.auth.user()!;
    return `dm-${Math.min(me.id, otherUserId)}-${Math.max(me.id, otherUserId)}`;
  }

  getDMConversation(otherUserId: number): Conversation {
    if (otherUserId === HELPDESK_AGENT.id) {
      return { id: HELPDESK_CONV_ID, type: 'direct', name: HELPDESK_AGENT.name, participants: [this.auth.user()?.id ?? 0, 0] };
    }
    const me    = this.auth.user()!;
    const other = this.allUsers.find(u => u.id === otherUserId);
    return { id: this.getDMId(otherUserId), type: 'direct', name: other?.name ?? 'Usuario', participants: [me.id, otherUserId] };
  }

  isHelpdeskConv(conversationId: string): boolean {
    return conversationId === HELPDESK_CONV_ID;
  }

  private _ensureSignal(conversationId: string): ReturnType<typeof signal<ChatMessage[]>> {
    if (!this._messages.has(conversationId)) {
      const sig = signal<ChatMessage[]>([]);
      this._messages.set(conversationId, sig);
      if (conversationId !== HELPDESK_CONV_ID) {
        this.http.get<ChatMessage[]>(`/api/chat/messages?conversationId=${conversationId}`).subscribe({
          next: async msgs => {
            const decrypted = await Promise.all(
              msgs.map(async m => {
                const dec = await this.crypto.decryptFields(m as any, CHAT_ENCRYPTED_FIELDS);
                return { ...dec, timestamp: new Date(m.timestamp) } as ChatMessage;
              })
            );
            sig.set(decrypted);
          }
        });
      }
    }
    return this._messages.get(conversationId)!;
  }

  getMessagesSignal(conversationId: string) {
    return this._ensureSignal(conversationId).asReadonly();
  }

  getMessages(conversationId: string): ChatMessage[] {
    return this._ensureSignal(conversationId)();
  }

  sendMessage(conversationId: string, content: string): void {
    const me = this.auth.user();
    if (!me || !content.trim()) return;

    if (this.isHelpdeskConv(conversationId)) {
      this._sendHelpdeskMessage(content.trim());
      return;
    }

    const meUser  = this.allUsers.find(u => u.id === me.id);
    const payload = {
      conversationId,
      senderId:     me.id,
      senderName:   me.name,
      senderAvatar: meUser?.avatar ?? me.name.charAt(0),
      content:      content.trim()
    };
    this.crypto.encryptFields(payload as any, CHAT_ENCRYPTED_FIELDS).then(encrypted => {
      this.http.post<ChatMessage>('/api/chat/messages', encrypted).subscribe({
        next: async msg => {
          const dec = await this.crypto.decryptFields(msg as any, CHAT_ENCRYPTED_FIELDS);
          const m   = { ...dec, timestamp: new Date(msg.timestamp) } as ChatMessage;
          this._ensureSignal(conversationId).update(arr => [...arr, m]);
          this.markRead(conversationId);
        }
      });
    });
  }

  private _sendHelpdeskMessage(content: string): void {
    const me = this.auth.user();
    if (!me) return;

    const userMsg: ChatMessage = {
      id:              _msgSeq--,
      conversationId:  HELPDESK_CONV_ID,
      senderId:        me.id,
      senderName:      me.name,
      senderAvatar:    me.name.charAt(0).toUpperCase(),
      content,
      timestamp:       new Date(),
    };

    const sig = this._ensureSignal(HELPDESK_CONV_ID);
    sig.update(arr => [...arr, userMsg]);
    this.markRead(HELPDESK_CONV_ID);

    this.http.post<{ message?: string }>('/api/helpdesk/message', { content, userName: me.name, userId: me.id }).subscribe({
      next: () => {
        setTimeout(() => {
          sig.update(arr => [...arr, {
            id:           _msgSeq--,
            conversationId: HELPDESK_CONV_ID,
            senderId:     HELPDESK_AGENT.id,
            senderName:   HELPDESK_AGENT.name,
            senderAvatar: HELPDESK_AGENT.avatar,
            content:      HELPDESK_AUTO_REPLY,
            timestamp:    new Date(),
          }]);
        }, 1200);
      },
      error: (err) => {
        const agentMsg = err?.status === 429
          ? `⏳ ${err?.error?.message ?? 'Demasiados mensajes. Intenta en unos minutos.'}`
          : '⚠️ No pude conectar con el servicio de soporte en este momento. Por favor intenta nuevamente o escríbenos a soporte@dairi.cl';
        setTimeout(() => {
          sig.update(arr => [...arr, {
            id:           _msgSeq--,
            conversationId: HELPDESK_CONV_ID,
            senderId:     HELPDESK_AGENT.id,
            senderName:   HELPDESK_AGENT.name,
            senderAvatar: HELPDESK_AGENT.avatar,
            content:      agentMsg,
            timestamp:    new Date(),
          }]);
        }, 800);
      }
    });
  }

  markRead(conversationId: string): void {
    const me = this.auth.user();
    if (!me) return;
    const msgs = this._messages.get(conversationId)?.() ?? [];
    const last = msgs[msgs.length - 1];
    if (last) this._lastRead.set(`${me.id}:${conversationId}`, last.id);
  }

  getUnreadCount(conversationId: string): number {
    const me = this.auth.user();
    if (!me) return 0;
    const lastReadId = this._lastRead.get(`${me.id}:${conversationId}`) ?? 0;
    return (this._messages.get(conversationId)?.() ?? [])
      .filter(m => m.id > lastReadId && m.senderId !== me.id).length;
  }

  getLastMessage(conversationId: string): ChatMessage | null {
    const msgs = this._messages.get(conversationId)?.() ?? [];
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  }

  getUserColor(userId: number): string {
    if (userId === HELPDESK_AGENT.id) return HELPDESK_AGENT.color;
    return this.allUsers.find(u => u.id === userId)?.color ?? '#6b7280';
  }
}
