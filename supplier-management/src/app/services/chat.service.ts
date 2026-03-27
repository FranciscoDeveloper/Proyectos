import { Injectable, signal, computed, inject } from '@angular/core';
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

// ─── All users known to the chat system ──────────────────────────────────────
const ALL_USERS: ChatUser[] = [
  { id: 1, name: 'Admin General',    avatar: 'AG', role: 'admin',   online: true,  color: '#6366f1' },
  { id: 2, name: 'Jefe de Compras',  avatar: 'JC', role: 'manager', online: true,  color: '#10b981' },
  { id: 3, name: 'Dra. Morales',     avatar: 'DM', role: 'manager', online: true,  color: '#ef4444' },
  { id: 4, name: 'Auditor',          avatar: 'AU', role: 'viewer',  online: false, color: '#f59e0b' },
  { id: 5, name: 'Ps. Carolina Vega',avatar: 'CV', role: 'manager', online: true,  color: '#8b5cf6' },
  { id: 6, name: 'Dr. Ramírez',      avatar: 'DR', role: 'manager', online: true,  color: '#14b8a6' },
];

// ─── Static channel definitions ───────────────────────────────────────────────
const CHANNELS: Conversation[] = [
  { id: 'ch-general',   type: 'channel', name: 'general',   icon: '#', participants: [] },
  { id: 'ch-anuncios',  type: 'channel', name: 'anuncios',  icon: '📢', participants: [] },
  { id: 'ch-clinica',   type: 'channel', name: 'clínica',   icon: '🏥', participants: [] },
];

// ─── Seed messages ────────────────────────────────────────────────────────────
const d = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);

const SEED_MESSAGES: ChatMessage[] = [
  // #general
  { id: 1,  conversationId: 'ch-general', senderId: 1, senderName: 'Admin General',     senderAvatar: 'AG', content: '¡Bienvenidos al sistema! Este es el canal general del equipo.', timestamp: d(120) },
  { id: 2,  conversationId: 'ch-general', senderId: 3, senderName: 'Dra. Morales',      senderAvatar: 'DM', content: 'Gracias. Recuerden actualizar las fichas clínicas pendientes.', timestamp: d(110) },
  { id: 3,  conversationId: 'ch-general', senderId: 5, senderName: 'Ps. Carolina Vega', senderAvatar: 'CV', content: 'Entendido. También aviso que el lunes hay capacitación sobre el nuevo módulo.', timestamp: d(105) },
  { id: 4,  conversationId: 'ch-general', senderId: 6, senderName: 'Dr. Ramírez',       senderAvatar: 'DR', content: '¿A qué hora es la capacitación?', timestamp: d(100) },
  { id: 5,  conversationId: 'ch-general', senderId: 1, senderName: 'Admin General',     senderAvatar: 'AG', content: 'Será a las 9:00 AM en sala de reuniones 2.', timestamp: d(95)  },
  { id: 6,  conversationId: 'ch-general', senderId: 2, senderName: 'Jefe de Compras',   senderAvatar: 'JC', content: 'Confirmado, estaremos presentes del área de compras.', timestamp: d(90)  },
  // #anuncios
  { id: 7,  conversationId: 'ch-anuncios', senderId: 1, senderName: 'Admin General',    senderAvatar: 'AG', content: '📌 Sistema actualizado a la versión más reciente. Nuevas funciones: módulo de odontología y psicología.', timestamp: d(60)  },
  { id: 8,  conversationId: 'ch-anuncios', senderId: 1, senderName: 'Admin General',    senderAvatar: 'AG', content: '📌 Recordatorio: las contraseñas se deben cambiar cada 90 días.', timestamp: d(30)  },
  // #clínica
  { id: 9,  conversationId: 'ch-clinica',  senderId: 3, senderName: 'Dra. Morales',     senderAvatar: 'DM', content: 'Revisé las fichas pendientes. Hay 3 pacientes con controles vencidos.', timestamp: d(50)  },
  { id: 10, conversationId: 'ch-clinica',  senderId: 5, senderName: 'Ps. Carolina Vega',senderAvatar: 'CV', content: 'En mi agenda tengo a Valentina Rojas para esta semana. La evaluación va bien.', timestamp: d(45)  },
  { id: 11, conversationId: 'ch-clinica',  senderId: 6, senderName: 'Dr. Ramírez',      senderAvatar: 'DR', content: 'Andrea Muñoz tiene su ortodoncia progresando muy bien. Estimamos alta en 6 meses.', timestamp: d(40)  },
  { id: 12, conversationId: 'ch-clinica',  senderId: 3, senderName: 'Dra. Morales',     senderAvatar: 'DM', content: 'Excelente. Coordinemos una reunión clínica el próximo viernes.', timestamp: d(35)  },
  // DM: Admin ↔ Dra. Morales
  { id: 13, conversationId: 'dm-1-3', senderId: 1, senderName: 'Admin General',  senderAvatar: 'AG', content: 'Hola Dra., ¿ya tiene acceso al nuevo módulo de fichas clínicas?', timestamp: d(80) },
  { id: 14, conversationId: 'dm-1-3', senderId: 3, senderName: 'Dra. Morales',   senderAvatar: 'DM', content: 'Sí, perfecto. Muy intuitivo. Gracias por el trabajo del equipo.', timestamp: d(75) },
  // DM: Admin ↔ Jefe de Compras
  { id: 15, conversationId: 'dm-1-2', senderId: 2, senderName: 'Jefe de Compras',senderAvatar: 'JC', content: 'Necesito acceso al reporte de proveedores del Q1. ¿Puedes generarlo?', timestamp: d(20) },
  { id: 16, conversationId: 'dm-1-2', senderId: 1, senderName: 'Admin General',  senderAvatar: 'AG', content: 'Claro, te lo envío esta tarde.', timestamp: d(15) },
];

// ─── DM conversation ID helper ────────────────────────────────────────────────
function dmId(a: number, b: number): string {
  return `dm-${Math.min(a, b)}-${Math.max(a, b)}`;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private auth = inject(AuthService);

  // All users (contacts)
  readonly allUsers: ChatUser[] = ALL_USERS;

  // Messages store: conversationId → signal<ChatMessage[]>
  private _messages = new Map<string, ReturnType<typeof signal<ChatMessage[]>>>();

  // Last read message id per "userId:conversationId"
  private _lastRead = new Map<string, number>();

  private _nextMsgId = SEED_MESSAGES.length + 1;

  constructor() {
    // Seed channels
    for (const msg of SEED_MESSAGES) {
      if (!this._messages.has(msg.conversationId)) {
        this._messages.set(msg.conversationId, signal<ChatMessage[]>([]));
      }
      this._messages.get(msg.conversationId)!.update(arr => [...arr, msg]);
    }
  }

  // ── Channels ────────────────────────────────────────────────────────────────

  readonly channels: Conversation[] = CHANNELS;

  // ── Direct messages ──────────────────────────────────────────────────────────

  /** Returns all users except the currently logged-in user */
  getContacts(): ChatUser[] {
    const me = this.auth.user();
    return ALL_USERS.filter(u => u.id !== me?.id);
  }

  /** Get or create a DM conversation id for two users */
  getDMId(otherUserId: number): string {
    const me = this.auth.user()!;
    return dmId(me.id, otherUserId);
  }

  getDMConversation(otherUserId: number): Conversation {
    const me = this.auth.user()!;
    const other = ALL_USERS.find(u => u.id === otherUserId)!;
    const id = dmId(me.id, otherUserId);
    return {
      id,
      type: 'direct',
      name: other.name,
      participants: [me.id, otherUserId]
    };
  }

  // ── Messages ─────────────────────────────────────────────────────────────────

  getMessages(conversationId: string): ChatMessage[] {
    if (!this._messages.has(conversationId)) {
      this._messages.set(conversationId, signal<ChatMessage[]>([]));
    }
    return this._messages.get(conversationId)!();
  }

  getMessagesSignal(conversationId: string) {
    if (!this._messages.has(conversationId)) {
      this._messages.set(conversationId, signal<ChatMessage[]>([]));
    }
    return this._messages.get(conversationId)!.asReadonly();
  }

  sendMessage(conversationId: string, content: string): void {
    const me = this.auth.user();
    if (!me || !content.trim()) return;
    const meUser = ALL_USERS.find(u => u.id === me.id);
    const msg: ChatMessage = {
      id: this._nextMsgId++,
      conversationId,
      senderId: me.id,
      senderName: me.name,
      senderAvatar: meUser?.avatar ?? me.name.charAt(0),
      content: content.trim(),
      timestamp: new Date()
    };
    if (!this._messages.has(conversationId)) {
      this._messages.set(conversationId, signal<ChatMessage[]>([]));
    }
    this._messages.get(conversationId)!.update(arr => [...arr, msg]);
    this.markRead(conversationId);
  }

  // ── Unread ───────────────────────────────────────────────────────────────────

  markRead(conversationId: string): void {
    const me = this.auth.user();
    if (!me) return;
    const msgs = this.getMessages(conversationId);
    const last = msgs[msgs.length - 1];
    if (last) this._lastRead.set(`${me.id}:${conversationId}`, last.id);
  }

  getUnreadCount(conversationId: string): number {
    const me = this.auth.user();
    if (!me) return 0;
    const lastReadId = this._lastRead.get(`${me.id}:${conversationId}`) ?? 0;
    const msgs = this.getMessages(conversationId);
    return msgs.filter(m => m.id > lastReadId && m.senderId !== me.id).length;
  }

  /** Last message in a conversation, for the sidebar preview */
  getLastMessage(conversationId: string): ChatMessage | null {
    const msgs = this.getMessages(conversationId);
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  }

  /** Color for a user id */
  getUserColor(userId: number): string {
    return ALL_USERS.find(u => u.id === userId)?.color ?? '#6b7280';
  }
}
