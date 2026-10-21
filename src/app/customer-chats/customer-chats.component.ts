import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

/** A WhatsApp / Instagram conversation from GET /api/boutique-chats (srisa-agent's staff inbox). */
export interface ChatSummary {
  id: string;
  channel: 'whatsapp' | 'instagram';
  customer_name: string | null;
  profile_username: string | null;
  phone: string | null;
  needs_human: boolean;
  needs_human_reason: string | null;
  needs_human_since: string | null;
  current_design: string | null;
  last_customer_message_at: string | null;
  reply_window_open: boolean;
  waiting_messages: number;
  last_message: { direction: string; author: string | null; text: string; status?: string; at: string } | null;
}

export interface ChatMessage {
  id: string;
  direction: 'in' | 'out';
  author: 'customer' | 'bot' | 'staff';
  type: string;
  text: string | null;
  status: string;
  at: string;
  image_url: string | null;
}

export interface ChatDetail extends ChatSummary {
  messages: ChatMessage[];
  orders: { order_no: string; status: string; design_code: string; design_name: string; size_code: string;
            total: number; payment_status: string | null; paid_at: string | null; razorpay_payment_id: string | null;
            created_at: string }[];
}

@Component({
  selector: 'app-customer-chats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-chats.component.html',
  styleUrl: './customer-chats.component.css'
})
export class CustomerChatsComponent implements OnInit, OnDestroy {
  /** Opened from a staff alert link (?chat=<id>). */
  @Input() initialChatId: string | null = null;

  chats: ChatSummary[] = [];
  filter: 'waiting' | 'all' = 'waiting';
  loading = false;
  error = '';

  selected: ChatDetail | null = null;
  loadingChat = false;
  reply = '';
  sending = false;
  actionError = '';

  private timer: ReturnType<typeof setInterval> | null = null;

  readonly reasonLabel: { [r: string]: string } = {
    damaged_item: 'Damaged item', complaint: 'Complaint', wants_person: 'Wants a person',
    size_outside_chart: 'Size outside chart', temporarily_unavailable: 'System problem', staff_reply: 'Staff replied',
    staff_took_over: 'Staff replied (Instagram app)', with_team: 'With team'
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
    if (this.initialChatId) this.open(this.initialChatId);
    // Refresh the list and the open chat every 15 s (new customer messages, other staff replies).
    this.timer = setInterval(() => {
      this.load(true);
      if (this.selected && !this.sending) this.open(this.selected.id, true);
    }, 15000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('mybill_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  load(silent = false) {
    if (!silent) { this.loading = true; this.error = ''; }
    this.http.get<ChatSummary[]>('/api/boutique-chats', { headers: this.headers(), params: { status: this.filter } })
      .subscribe({
        next: chats => { this.chats = chats; this.loading = false; },
        error: err => { this.loading = false; if (!silent) this.error = err?.error?.message || 'Could not load chats'; }
      });
  }

  setFilter(f: 'waiting' | 'all') { this.filter = f; this.load(); }

  /** WhatsApp-style ticks for our messages: ✓ sent, ✓✓ delivered, blue ✓✓ read, ⚠ not delivered. */
  tick(status?: string): string {
    switch (status) {
      case 'sent': return '✓';
      case 'delivered': case 'read': return '✓✓';
      case 'failed': return '⚠';
      default: return '🕓';
    }
  }

  tickTitle(status?: string): string {
    switch (status) {
      case 'sent': return 'Sent';
      case 'delivered': return 'Delivered';
      case 'read': return 'Seen';
      case 'failed': return 'Not delivered';
      default: return 'Sending';
    }
  }

  open(id: string, silent = false) {
    if (!silent) { this.loadingChat = true; this.actionError = ''; }
    this.http.get<ChatDetail>(`/api/boutique-chats/${id}`, { headers: this.headers() }).subscribe({
      next: chat => {
        const newMessages = !this.selected || this.selected.id !== chat.id || this.selected.messages.length !== chat.messages.length;
        this.selected = chat;
        this.loadingChat = false;
        if (newMessages) setTimeout(() => this.scrollToEnd(), 0);
      },
      error: err => { this.loadingChat = false; if (!silent) this.actionError = err?.error?.message || 'Could not open the chat'; }
    });
  }

  private scrollToEnd() {
    const el = document.querySelector('.cc-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  send() {
    const text = this.reply.trim();
    if (!this.selected || !text || this.sending) return;
    this.sending = true;
    this.actionError = '';
    this.http.post(`/api/boutique-chats/${this.selected.id}/reply`, { text }, { headers: this.headers() }).subscribe({
      next: () => { this.sending = false; this.reply = ''; this.open(this.selected!.id, true); this.load(true); },
      error: err => { this.sending = false; this.actionError = err?.error?.message || 'Message not sent'; }
    });
  }

  onKey(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) this.send();
  }

  resolve() {
    if (!this.selected || !confirm('Mark this issue as resolved? The AI assistant will answer this customer again.')) return;
    this.action('resolve');
  }

  keep() { this.action('keep'); }

  private action(kind: 'resolve' | 'keep') {
    if (!this.selected) return;
    this.http.post(`/api/boutique-chats/${this.selected.id}/${kind}`, {}, { headers: this.headers() }).subscribe({
      next: () => { this.open(this.selected!.id, true); this.load(true); },
      error: err => { this.actionError = err?.error?.message || 'Could not update the chat'; }
    });
  }

  name(c: ChatSummary): string {
    return c.customer_name || (c.profile_username ? '@' + c.profile_username : (c.phone || 'Customer'));
  }

  contact(c: ChatSummary): string {
    return c.channel === 'instagram' ? (c.profile_username ? 'Instagram @' + c.profile_username : 'Instagram') : (c.phone || '');
  }

  reason(c: ChatSummary): string {
    const r = c.needs_human_reason || '';
    if (r.startsWith('llm_failure')) return 'AI problem';
    if (r.startsWith('order_failed')) return 'Order problem';
    return this.reasonLabel[r] || r.replace(/_/g, ' ');
  }

  waitingFor(c: ChatSummary): string {
    if (!c.needs_human_since) return '';
    const minutes = Math.max(0, Math.round((Date.now() - new Date(c.needs_human_since).getTime()) / 60000));
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} days`;
  }
}
