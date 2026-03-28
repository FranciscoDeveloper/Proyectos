import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

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

/**
 * Chat service backed by the mock REST API (/api/chat/*).
 *
 * Endpoints used
 * ──────────────
 *  GET  /api/chat/users
 *  GET  /api/chat/messages?conversationId=:id
 *  POST /api/chat/messages
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  // Static channel definitions
  readonly channels: Conversation[] = [
    { id: 'ch-general',  type: 'channel', name: 'general',  icon: '#',  participants: [] },
    { id: 'ch-anuncios', type: 'channel', name: 'anuncios', icon: '📢', participants: [] },
    { id: 'ch-clinica',  type: 'channel', name: 'clínica',  icon: '🏥', participants: [] },
  ];

  // All users loaded from GET /api/chat/users
  readonly allUsers: ChatUser[] = [];

  constructor() {
    this.http.get<ChatUser[]>('/api/chat/users').subscribe({
      next: users => this.allUsers.splice(0, this.allUsers.length, ...users)
    });
  }

  // Messages store: conversationId → signal<ChatMessage[]>
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
        next: msgs => sig.set(msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp) })))
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
    this.http.post<ChatMessage>('/api/chat/messages', payload).subscribe({
      next: msg => {
        const m = { ...msg, timestamp: new Date(msg.timestamp) };
        this._ensureSignal(conversationId).update(arr => [...arr, m]);
        this.markRead(conversationId);
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
    return this.allUsers.find(u => u.id === userId)?.color ?? '#6b7280';
  }
}
