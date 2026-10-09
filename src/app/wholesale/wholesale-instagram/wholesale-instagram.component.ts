import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import { AuthService } from '../../auth.service';
import { WholesaleCustomerPickerComponent } from '../wholesale-customer-picker/wholesale-customer-picker.component';
import {
  WholesaleCustomer, WholesaleIgConversation, WholesaleIgConversationSummary, WholesaleIgFilter,
  WholesaleIgMessage, WholesaleInstagramSettings, WholesaleInstagramSettingsRequest
} from '../wholesale.model';

type Tab = 'inbox' | 'settings';

const REFRESH_MS = 15000;

/**
 * Wholesale Instagram inbox: customer conversations with automatic AI replies (built only from wholesale product,
 * price and stock data), staff replies, human takeover, customer mapping and connection settings.
 */
@Component({
  selector: 'app-wholesale-instagram',
  standalone: true,
  imports: [CommonModule, FormsModule, WholesaleCustomerPickerComponent],
  templateUrl: './wholesale-instagram.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-instagram.component.css']
})
export class WholesaleInstagramComponent implements OnInit, OnDestroy {
  @ViewChild('thread') threadEl?: ElementRef<HTMLElement>;

  readonly filters: { value: WholesaleIgFilter; label: string }[] = [
    { value: '', label: 'All' }, { value: 'ATTENTION', label: 'Needs attention' },
    { value: 'TAKEOVER', label: 'Human takeover' }, { value: 'UNREAD', label: 'Unread' }
  ];

  tab: Tab = 'inbox';
  isAdmin = false;
  error = '';
  message = '';

  // Inbox
  conversations: WholesaleIgConversationSummary[] = [];
  search = '';
  filter: WholesaleIgFilter = '';
  selected: WholesaleIgConversation | null = null;
  reply = '';
  sending = false;
  showLinkPicker = false;
  expanded = new Set<number>();
  private search$ = new Subject<void>();
  private subs: Subscription[] = [];
  private timer?: ReturnType<typeof setInterval>;

  // Settings
  settings: WholesaleInstagramSettings | null = null;
  form: WholesaleInstagramSettingsRequest | null = null;
  newAccessToken = '';
  newAppSecret = '';
  clearAccessToken = false;
  clearAppSecret = false;
  savingSettings = false;

  constructor(private ws: WholesaleService, private auth: AuthService) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.isAdmin();
    this.subs.push(this.search$.pipe(debounceTime(300)).subscribe(() => this.loadConversations()));
    this.loadSettings();
    this.loadConversations();
    this.timer = setInterval(() => this.refresh(), REFRESH_MS);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.timer) clearInterval(this.timer);
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.error = '';
    this.message = '';
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────────────────────────

  onSearch(): void {
    this.search$.next();
  }

  setFilter(filter: WholesaleIgFilter): void {
    this.filter = filter;
    this.loadConversations();
  }

  loadConversations(): void {
    this.ws.getIgConversations(this.search, this.filter).subscribe({
      next: list => this.conversations = list,
      error: err => this.error = this.errorText(err, 'Could not load conversations')
    });
  }

  /** Background poll: list always; the open thread only when nothing is being typed or sent. */
  private refresh(): void {
    if (this.tab !== 'inbox' || document.hidden) return;
    this.loadConversations();
    if (this.selected && !this.sending) this.reload(this.selected.conversation.conversationId, false);
  }

  open(c: WholesaleIgConversationSummary): void {
    this.reply = '';
    this.showLinkPicker = false;
    this.expanded.clear();
    this.reload(c.conversationId, true);
    if (c.unreadCount > 0) {
      this.ws.markIgConversationRead(c.conversationId).subscribe({ next: s => this.replaceSummary(s) });
    }
  }

  private reload(id: number, scroll: boolean): void {
    this.ws.getIgConversation(id).subscribe({
      next: conv => {
        const grew = !this.selected || this.selected.conversation.conversationId !== id
          || this.selected.messages.length !== conv.messages.length;
        this.selected = conv;
        if (scroll || grew) setTimeout(() => this.scrollToEnd());
      },
      error: err => this.error = this.errorText(err, 'Could not load the conversation')
    });
  }

  send(): void {
    if (!this.selected || !this.reply.trim() || this.sending) return;
    const id = this.selected.conversation.conversationId;
    this.sending = true;
    this.error = '';
    this.ws.sendIgMessage(id, this.reply.trim()).subscribe({
      next: m => {
        this.sending = false;
        if (m.status === 'FAILED') {
          this.error = 'Instagram did not accept the message: ' + (m.errorMessage || 'unknown error') + ' (kept in the conversation as failed).';
        } else {
          this.reply = '';
        }
        this.reload(id, true);
        this.loadConversations();
      },
      error: err => {
        this.sending = false;
        this.error = this.errorText(err, 'Could not send the message');
      }
    });
  }

  takeOver(): void {
    if (!this.selected) return;
    this.ws.takeOverIgConversation(this.selected.conversation.conversationId).subscribe({
      next: s => this.applySummary(s, 'Human takeover on — the AI will not reply in this conversation.'),
      error: err => this.error = this.errorText(err, 'Could not take over')
    });
  }

  release(): void {
    if (!this.selected) return;
    this.ws.releaseIgConversation(this.selected.conversation.conversationId).subscribe({
      next: s => this.applySummary(s, 'AI auto-replies re-enabled for new messages in this conversation.'),
      error: err => this.error = this.errorText(err, 'Could not re-enable AI')
    });
  }

  resolve(): void {
    if (!this.selected) return;
    this.ws.resolveIgConversation(this.selected.conversation.conversationId).subscribe({
      next: s => this.applySummary(s, ''),
      error: err => this.error = this.errorText(err, 'Could not update the conversation')
    });
  }

  linkCustomer(customer: WholesaleCustomer | null): void {
    if (!this.selected || !customer) return;
    this.ws.linkIgCustomer(this.selected.conversation.conversationId, customer.wholesaleCustomerId).subscribe({
      next: s => { this.showLinkPicker = false; this.applySummary(s, 'Linked to ' + s.customerName + '.'); },
      error: err => this.error = this.errorText(err, 'Could not link the customer')
    });
  }

  unlinkCustomer(): void {
    if (!this.selected) return;
    this.ws.linkIgCustomer(this.selected.conversation.conversationId, null).subscribe({
      next: s => this.applySummary(s, 'Customer link removed.'),
      error: err => this.error = this.errorText(err, 'Could not remove the link')
    });
  }

  toggleDetails(m: WholesaleIgMessage): void {
    this.expanded.has(m.messageId) ? this.expanded.delete(m.messageId) : this.expanded.add(m.messageId);
  }

  private applySummary(s: WholesaleIgConversationSummary, message: string): void {
    this.message = message;
    this.error = '';
    if (this.selected && this.selected.conversation.conversationId === s.conversationId) {
      this.selected = { ...this.selected, conversation: s };
    }
    this.replaceSummary(s);
  }

  private replaceSummary(s: WholesaleIgConversationSummary): void {
    this.conversations = this.conversations.map(c => c.conversationId === s.conversationId ? s : c);
  }

  private scrollToEnd(): void {
    const el = this.threadEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // ── Settings ───────────────────────────────────────────────────────────────────────────────────

  loadSettings(): void {
    this.ws.getInstagramSettings().subscribe({
      next: s => this.applySettings(s),
      error: err => this.error = this.errorText(err, 'Could not load Instagram settings')
    });
  }

  private applySettings(s: WholesaleInstagramSettings): void {
    this.settings = s;
    this.form = {
      isEnabled: s.isEnabled, autoReplyEnabled: s.autoReplyEnabled, instagramAccountId: s.instagramAccountId ?? '',
      apiBaseUrl: s.apiBaseUrl, accessToken: null, appSecret: null, verifyToken: s.verifyToken ?? '',
      handoffMessage: s.handoffMessage
    };
    this.newAccessToken = '';
    this.newAppSecret = '';
    this.clearAccessToken = false;
    this.clearAppSecret = false;
  }

  generateVerifyToken(): void {
    if (!this.form) return;
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    this.form.verifyToken = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  saveSettings(): void {
    if (!this.form || this.savingSettings) return;
    const request: WholesaleInstagramSettingsRequest = {
      ...this.form,
      accessToken: this.clearAccessToken ? '' : (this.newAccessToken.trim() || null),
      appSecret: this.clearAppSecret ? '' : (this.newAppSecret.trim() || null)
    };
    this.savingSettings = true;
    this.error = '';
    this.ws.saveInstagramSettings(request).subscribe({
      next: s => { this.savingSettings = false; this.applySettings(s); this.message = 'Instagram settings saved.'; },
      error: err => { this.savingSettings = false; this.error = this.errorText(err, 'Could not save the settings'); }
    });
  }

  get webhookUrl(): string {
    return this.settings?.webhookPath ? window.location.origin + this.settings.webhookPath : '';
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.message = 'Copied.');
  }

  // ── View helpers ───────────────────────────────────────────────────────────────────────────────

  title(c: WholesaleIgConversationSummary): string {
    return c.customerName || c.displayName || (c.instagramUsername ? '@' + c.instagramUsername : 'Instagram user ' + c.instagramUserId.slice(-6));
  }

  senderLabel(m: WholesaleIgMessage): string {
    if (m.senderType === 'AI') return 'AI assistant';
    if (m.senderType === 'STAFF') return m.sentBy ? 'Staff · ' + m.sentBy : 'Staff';
    return 'Customer';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      RECEIVED: 'Waiting', PROCESSING: 'AI is replying…', REPLIED: 'AI replied', NEEDS_HUMAN: 'Needs a person',
      HUMAN_TAKEOVER: 'Not answered — human takeover', AI_DISABLED: 'Not answered — auto-reply off', IGNORED: 'Ignored',
      FAILED: 'Failed', PENDING: 'Sending…', SENT: 'Sent'
    };
    return labels[status] || status;
  }

  json(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  replySourceLabel(m: WholesaleIgMessage): string {
    const x = m.extracted as { replySource?: string; answered?: boolean; confidence?: string } | null;
    const source = x?.replySource;
    const base = source === 'AI' ? 'AI reply, numbers checked against tool results'
      : source === 'UNKNOWN' ? '"Don\'t have that information" reply'
      : source === 'ERROR' ? 'Holding message (AI unavailable)'
      : source === 'TEMPLATE' ? 'Standard reply from business data' : '';
    if (!base) return '';
    return base + (x?.answered === false ? ' · not fully answered' : '') + (x?.confidence === 'low' ? ' · low confidence' : '');
  }

  toolCalls(m: WholesaleIgMessage): { tool: string; input: unknown; result: unknown }[] {
    const calls = (m.facts as { toolCalls?: { tool: string; input: unknown; result: unknown }[] } | null)?.toolCalls;
    return Array.isArray(calls) ? calls : [];
  }

  private errorText(err: any, fallback: string): string {
    return err?.error?.message || fallback;
  }
}
