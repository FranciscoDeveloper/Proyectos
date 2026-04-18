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
}

export interface ChatMessage {
  id: number;
  conversationId: string;
  senderId: number;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  type: 'channel' | 'direct';
  name: string;
  icon?: string;
  participants: number[];
}

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
  }

  private _messages = new Map<string, ReturnType<typeof signal<ChatMessage[]>>>();
  private _lastRead  = new Map<string, number>();

  getContacts(): ChatUser[] {
    const me = this.auth.user();
    return this.allUsers.filter(u => u.id !== me?.id);
  }

  getDMId(otherUserId: number): string {
    const me = this.auth.user()!;
    return `dm-${Math.min(me.id, otherUserId)}-${Math.max(me.id, otherUserId)}`;
  }

  getDMConversation(otherUserId: number): Conversation {
    const me    = this.auth.user()!;
    const other = this.allUsers.find(u => u.id === otherUserId);
    return {
      id: this.getDMId(otherUserId),
      type: 'direct',
      name: other?.name ?? 'Usuario',
      participants: [me.id, otherUserId]
    };
  }

  private _ensureSignal(conversationId: string): ReturnType<typeof signal<ChatMessage[]>> {
    if (!this._messages.has(conversationId)) {
      const sig = signal<ChatMessage[]>([]);
      this._messages.set(conversationId, sig);
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
    const meUser  = this.allUsers.find(u => u.id === me.id);
    const payload = {
      conversationId,
      senderId:     me.id,
      senderName:   me.name,
      senderAvatar: meUser?.avatar ?? me.name.charAt(0),
      content: content.trim()
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
    return this.allUsers.find(u => u.id === userId)?.color ?? '#6b7280';
  }
}
