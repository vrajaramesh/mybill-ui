import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription, concatMap, from, toArray } from 'rxjs';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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
  firm?: string;          // srisa (retail) / srihitha (wholesale)
  wholesale?: boolean;
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
  media?: string | null;
  followup?: string | null;   // automatic reminder: enquiry | enquiry_last | payment   // customer's WhatsApp image/sticker/video/document/audio (fetch via /media)
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
  photos: string[] = [];
  uploading = 0;
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
      if (this.selected && !this.sending && !this.loadingChat) this.open(this.selected.id, true);
    }, 15000);
  }

  /** Customer photos: blob URLs by message id ('' = not available any more). */
  mediaUrls: { [messageId: string]: string } = {};
  private mediaLoading = new Set<string>();

  private loadMedia(chat: ChatDetail) {
    for (const m of chat.messages) {
      if ((m.media === 'image' || m.media === 'sticker') && !(m.id in this.mediaUrls) && !this.mediaLoading.has(m.id)) {
        this.fetchMedia(chat.id, m.id).subscribe({
          next: blob => { this.mediaLoading.delete(m.id); this.mediaUrls[m.id] = URL.createObjectURL(blob); },
          error: () => { this.mediaLoading.delete(m.id); this.mediaUrls[m.id] = ''; }
        });
        this.mediaLoading.add(m.id);
      }
    }
  }

  private fetchMedia(chatId: string, messageId: string) {
    return this.http.get(`/api/boutique-chats/${chatId}/media/${messageId}`, { headers: this.headers(), responseType: 'blob' });
  }

  /** Videos / documents / voice notes: open in a new tab. */
  openMedia(m: ChatMessage) {
    if (!this.selected) return;
    const tab = window.open('', '_blank');
    this.fetchMedia(this.selected.id, m.id).subscribe({
      next: blob => { const url = URL.createObjectURL(blob); if (tab) tab.location.href = url; else window.open(url, '_blank'); },
      error: () => { tab?.close(); this.actionError = 'This file is no longer available on WhatsApp (kept about 30 days).'; }
    });
  }

  viewPhoto(url: string) { if (url) window.open(url, '_blank'); }

  ngOnDestroy() {
    Object.values(this.mediaUrls).forEach(u => u && URL.revokeObjectURL(u));
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

  /** Caption of a photo we sent ("[photo] Frock – ₹3,400 …"), or '' when the text is just the photo URL. */
  photoCaption(text: string | null): string {
    if (!text || !text.startsWith('[photo]')) return '';
    const caption = text.slice('[photo]'.length).trim();
    return /^https?:\/\/\S+$/.test(caption) ? '' : caption;
  }

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

  /** The chat being shown (or loading); responses for any other chat are ignored. */
  selectedId: string | null = null;
  private chatRequest: Subscription | null = null;

  /** Click on a customer: the panel switches to loading at once; silent = background refresh of the open chat. */
  open(id: string, silent = false) {
    if (silent && id !== this.selectedId) return;
    if (!silent) {
      if (id !== this.selectedId) {
        this.selected = null;          // never show the previous customer while the new one loads
        this.reply = '';               // a draft or photos belong to the previous customer
        this.photos = [];
      }
      this.selectedId = id;
      this.loadingChat = true;
      this.actionError = '';
    }
    this.chatRequest?.unsubscribe();
    this.chatRequest = this.http.get<ChatDetail>(`/api/boutique-chats/${id}`, { headers: this.headers() }).subscribe({
      next: chat => {
        if (chat.id !== this.selectedId) return;
        const newMessages = !this.selected || this.selected.id !== chat.id || this.selected.messages.length !== chat.messages.length;
        this.selected = chat;
        this.loadMedia(chat);
        this.loadingChat = false;
        if (newMessages) setTimeout(() => this.scrollToEnd(), 0);
      },
      error: err => {
        if (id !== this.selectedId) return;
        this.loadingChat = false;
        if (!silent) this.actionError = err?.error?.message || 'Could not open the chat';
      }
    });
  }

  private scrollToEnd() {
    const el = document.querySelector('.cc-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  /** Photos picked for the next reply (already uploaded; WhatsApp takes JPEG/PNG up to 5 MB). */
  onPhotos(event: Event) {
    const input = event.target as HTMLInputElement;
    for (const file of Array.from(input.files || [])) {
      if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > MAX_PHOTO_BYTES) {
        this.actionError = `${file.name}: only JPG/PNG photos up to 5 MB can be sent`;
        continue;
      }
      const form = new FormData();
      form.append('file', file);
      this.uploading++;
      this.http.post<{ secure_url?: string; url?: string }>('/api/upload/image', form, { headers: this.headers() }).subscribe({
        next: r => { this.uploading--; const url = r.secure_url || r.url; if (url) this.photos.push(url); },
        error: () => { this.uploading--; this.actionError = `${file.name}: upload failed`; }
      });
    }
    input.value = '';
  }

  removePhoto(i: number) { this.photos.splice(i, 1); }

  canSend(): boolean {
    return !!this.selected && this.selected.reply_window_open && !this.sending && this.uploading === 0
      && (!!this.reply.trim() || this.photos.length > 0);
  }

  /** Text, or each photo in turn (the text is the first photo's caption). */
  send() {
    if (!this.canSend()) return;
    const text = this.reply.trim();
    const bodies = this.photos.length
      ? this.photos.map((image_url, i) => ({ image_url, text: i === 0 ? text : '' }))
      : [{ text }];
    this.sending = true;
    this.actionError = '';
    const id = this.selected!.id;
    from(bodies).pipe(concatMap(b => this.http.post(`/api/boutique-chats/${id}/reply`, b, { headers: this.headers() })), toArray()).subscribe({
      next: () => { this.sending = false; this.reply = ''; this.photos = []; this.open(id, true); this.load(true); },
      error: err => { this.sending = false; this.actionError = err?.error?.message || 'Message not sent'; this.open(id, true); }
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

  /** How long ago the chat's latest message was: "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", "12 Oct". */
  ago(at: string | null | undefined): string {
    if (!at) return '';
    const then = new Date(at);
    const minutes = Math.max(0, Math.floor((Date.now() - then.getTime()) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
    const days = Math.floor(minutes / 1440);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
}
