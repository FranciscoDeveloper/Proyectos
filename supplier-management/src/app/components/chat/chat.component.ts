import {
  Component, inject, signal, computed, effect,
  ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService, ChatMessage, Conversation, ChatUser } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

interface ConvEntry {
  conv: Conversation;
  lastMessage: ChatMessage | null;
  unread: number;
  otherUser?: ChatUser;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements AfterViewChecked {
  readonly chatSvc  = inject(ChatService);
  readonly auth     = inject(AuthService);
  private cd        = inject(ChangeDetectorRef);

  @ViewChild('msgContainer') msgContainer?: ElementRef<HTMLElement>;

  // ── State ──────────────────────────────────────────────────────────────────
  activeConvId  = signal<string>('ch-general');
  messageText   = signal('');
  sidebarSection = signal<'channels' | 'dm'>('channels');
  private _shouldScroll = false;

  // ── Sidebar lists ──────────────────────────────────────────────────────────

  readonly channelEntries = computed<ConvEntry[]>(() =>
    this.chatSvc.channels.map(c => ({
      conv: c,
      lastMessage: this.chatSvc.getLastMessage(c.id),
      unread: this.chatSvc.getUnreadCount(c.id)
    }))
  );

  readonly dmEntries = computed<ConvEntry[]>(() => {
    return this.chatSvc.getContacts().map(u => {
      const convId = this.chatSvc.getDMId(u.id);
      return {
        conv: this.chatSvc.getDMConversation(u.id),
        lastMessage: this.chatSvc.getLastMessage(convId),
        unread: this.chatSvc.getUnreadCount(convId),
        otherUser: u
      };
    });
  });

  readonly totalUnread = computed(() =>
    [...this.channelEntries(), ...this.dmEntries()]
      .reduce((sum, e) => sum + e.unread, 0)
  );

  // ── Active conversation ────────────────────────────────────────────────────

  readonly activeMessages = computed(() =>
    this.chatSvc.getMessagesSignal(this.activeConvId())()
  );

  readonly activeConvName = computed(() => {
    const id = this.activeConvId();
    const channel = this.chatSvc.channels.find(c => c.id === id);
    if (channel) return (channel.icon ?? '#') + ' ' + channel.name;
    const contacts = this.chatSvc.getContacts();
    for (const u of contacts) {
      if (this.chatSvc.getDMId(u.id) === id) return u.name;
    }
    return '';
  });

  readonly activeConvType = computed<'channel' | 'direct'>(() => {
    const id = this.activeConvId();
    return this.chatSvc.channels.some(c => c.id === id) ? 'channel' : 'direct';
  });

  readonly activeOtherUser = computed<ChatUser | null>(() => {
    if (this.activeConvType() !== 'direct') return null;
    const id = this.activeConvId();
    return this.chatSvc.getContacts().find(u => this.chatSvc.getDMId(u.id) === id) ?? null;
  });

  // ── Methods ────────────────────────────────────────────────────────────────

  selectConv(id: string): void {
    this.activeConvId.set(id);
    this.chatSvc.markRead(id);
    this._shouldScroll = true;
  }

  send(): void {
    const text = this.messageText().trim();
    if (!text) return;
    this.chatSvc.sendMessage(this.activeConvId(), text);
    this.messageText.set('');
    this._shouldScroll = true;
    this.cd.detectChanges();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  isOwn(msg: ChatMessage): boolean {
    return msg.senderId === this.auth.user()?.id;
  }

  isSameAuthorAsPrev(messages: ChatMessage[], idx: number): boolean {
    if (idx === 0) return false;
    return messages[idx - 1].senderId === messages[idx].senderId &&
      (messages[idx].timestamp.getTime() - messages[idx - 1].timestamp.getTime()) < 5 * 60_000;
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
    const time = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return time;
    if (diffDays === 1) return `Ayer ${time}`;
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) + ' ' + time;
  }

  formatPreview(msg: ChatMessage | null): string {
    if (!msg) return 'Sin mensajes aún';
    const prefix = msg.senderName.split(' ')[0] + ': ';
    const text = msg.content.length > 35 ? msg.content.slice(0, 35) + '…' : msg.content;
    return prefix + text;
  }

  getUserColor(userId: number): string {
    return this.chatSvc.getUserColor(userId);
  }

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  ngAfterViewChecked(): void {
    if (this._shouldScroll) {
      this.scrollToBottom();
      this._shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    const el = this.msgContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Scroll on first load of each conversation
  constructor() {
    effect(() => {
      this.activeConvId(); // track
      this._shouldScroll = true;
    });
  }
}
