import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WholesaleService } from '../wholesale.service';
import { AuthService } from '../../auth.service';
import { WholesaleCustomerPickerComponent } from '../wholesale-customer-picker/wholesale-customer-picker.component';
import {
  WholesaleAssistantResult, WholesaleAssistantRole, WholesaleAssistantSettings, WholesaleCustomer
} from '../wholesale.model';

type Tab = 'chat' | 'knowledge';

interface ChatEntry {
  role: WholesaleAssistantRole;
  text: string;
  result?: WholesaleAssistantResult;
  showTools?: boolean;
}

/**
 * Wholesale AI Assistant: a test chat (same assistant as Instagram, dry run) and the knowledge base / rules it
 * answers from. The assistant only reaches business data through backend tools; this screen shows every tool call.
 */
@Component({
  selector: 'app-wholesale-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, WholesaleCustomerPickerComponent],
  templateUrl: './wholesale-assistant.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-assistant.component.css']
})
export class WholesaleAssistantComponent implements OnInit {
  @ViewChild('thread') threadEl?: ElementRef<HTMLElement>;

  readonly samples = [
    'Do you have Madras check cotton?', '100 meters?', 'Price?', 'What colours are available?', 'Minimum quantity?',
    'What is the HSN and GST?', 'How do I place an order?', 'Shipping to Chennai?', 'Prepare quotation',
    'Madras check 200 meters ki entha?'
  ];

  tab: Tab = 'chat';
  isAdmin = false;
  error = '';
  message = '';

  // Chat
  entries: ChatEntry[] = [];
  context: Record<string, unknown> = {};
  input = '';
  thinking = false;
  customer: WholesaleCustomer | null = null;

  // Knowledge
  settings: WholesaleAssistantSettings | null = null;
  form: WholesaleAssistantSettings | null = null;
  saving = false;

  constructor(private ws: WholesaleService, private auth: AuthService) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.isAdmin();
    this.ws.getAssistantSettings().subscribe({
      next: s => this.applySettings(s),
      error: err => this.error = err?.error?.message || 'Could not load the assistant settings'
    });
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.error = '';
    this.message = '';
  }

  // ── Chat ───────────────────────────────────────────────────────────────────────────────────────

  send(text?: string): void {
    const message = (text ?? this.input).trim();
    if (!message || this.thinking) return;
    const history = this.entries.map(e => ({ role: e.role, text: e.text }));
    this.entries.push({ role: 'CUSTOMER', text: message });
    this.input = '';
    this.thinking = true;
    this.error = '';
    this.scroll();
    this.ws.assistantChat({ message, history, context: this.context, customerId: this.customer?.wholesaleCustomerId ?? null }).subscribe({
      next: r => {
        this.thinking = false;
        this.context = r.context || {};
        this.entries.push({ role: 'ASSISTANT', text: r.reply, result: r });
        this.scroll();
      },
      error: err => {
        this.thinking = false;
        this.entries.pop();
        this.input = message;
        this.error = err?.error?.message || 'The assistant did not answer';
      }
    });
  }

  reset(): void {
    this.entries = [];
    this.context = {};
    this.input = '';
    this.error = '';
  }

  onCustomer(c: WholesaleCustomer | null): void {
    this.customer = c;
    this.reset();
  }

  get contextItems(): { label: string; value: string }[] {
    const c = this.context as Record<string, any>;
    const items: { label: string; value: string }[] = [];
    if (c['productName']) items.push({ label: 'Product', value: `${c['productName']} (#${c['productId']})` });
    if (c['quantity'] != null) items.push({ label: 'Quantity', value: `${c['quantity']} ${c['quantityUnit'] || c['unit'] || ''}` });
    if (c['quotationRef']) items.push({ label: 'Quotation', value: this.json(c['quotationRef']) });
    return items;
  }

  sourceLabel(r: WholesaleAssistantResult): string {
    return r.replySource === 'AI' ? 'verified' : r.replySource === 'UNKNOWN' ? 'unknown → standard reply' : 'AI unavailable';
  }

  json(v: unknown): string {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  }

  private scroll(): void {
    setTimeout(() => {
      const el = this.threadEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  // ── Knowledge ──────────────────────────────────────────────────────────────────────────────────

  private applySettings(s: WholesaleAssistantSettings): void {
    this.settings = s;
    this.form = { ...s };
  }

  save(): void {
    if (!this.form || this.saving) return;
    this.saving = true;
    this.error = '';
    this.ws.saveAssistantSettings(this.form).subscribe({
      next: s => { this.saving = false; this.applySettings(s); this.message = 'Assistant knowledge saved.'; },
      error: err => { this.saving = false; this.error = err?.error?.message || 'Could not save'; }
    });
  }
}
