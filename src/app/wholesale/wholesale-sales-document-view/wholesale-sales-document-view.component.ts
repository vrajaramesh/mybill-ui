import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import {
  WholesaleDocumentSettings, WholesalePaymentMode, WholesalePaymentRecord, WholesaleSalesDocument, WholesaleSalesDocumentType
} from '../wholesale.model';
import {
  TradeDocView, downloadViewPdf, paymentModeLabel, printView, salesDocumentView, salesStatusLabel, shareView,
  tradeDocumentHtml
} from '../wholesale-trade-documents';

const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** View / issue / payments / print / PDF / share / cancel one wholesale Sales Receipt or Credit Note. */
@Component({
  selector: 'app-wholesale-sales-document-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wholesale-sales-document-view.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-sales-document-view.component.css']
})
export class WholesaleSalesDocumentViewComponent implements OnChanges {
  @Input({ required: true }) documentId!: number;
  /** Emitted when the user clicks the source quotation link. */
  @Output() openQuotation = new EventEmitter<number>();
  /** Emitted after any change (issue, payment, cancel). */
  @Output() changed = new EventEmitter<WholesaleSalesDocument>();
  /** Emitted when the user wants to edit this draft (the parent shows the editor). */
  @Output() editDraft = new EventEmitter<number>();
  /** Emitted after a draft is deleted. */
  @Output() deleted = new EventEmitter<void>();
  /** Emitted when the user opens a referenced wholesale document. */
  @Output() openDocument = new EventEmitter<number>();
  /** Emitted for "New Credit Note / Debit Note against this document". */
  @Output() createAgainst = new EventEmitter<{ type: WholesaleSalesDocumentType; referenceId: number }>();

  /** Document types whose configuration allows referencing this document. */
  againstOptions: { type: WholesaleSalesDocumentType; label: string }[] = [];
  private typeSettings: WholesaleDocumentSettings[] = [];
  showAudit = false;

  readonly gstLabels: Record<string, string> = {
    TAX_INVOICE: 'Tax invoice', BILL_OF_SUPPLY: 'Bill of supply', CREDIT_NOTE: 'GST credit note', DEBIT_NOTE: 'GST debit note',
    RECEIPT_VOUCHER: 'Receipt voucher', OTHER: 'Other'
  };

  readonly paymentModes: { value: WholesalePaymentMode; label: string }[] = [
    { value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' },
    { value: 'CARD', label: 'Card' }, { value: 'CHEQUE', label: 'Cheque' }
  ];
  readonly paymentModeLabel = paymentModeLabel;
  readonly statusLabel = salesStatusLabel;
  readonly today = todayIso();

  doc: WholesaleSalesDocument | null = null;
  view: TradeDocView | null = null;
  previewHtml: SafeHtml | null = null;
  busy: '' | 'pdf' | 'share' | 'action' = '';
  error = '';
  message = '';

  // Payment form (add payment, or "issue with payment" for drafts)
  showPaymentForm = false;
  issuing = false;
  payDate = todayIso();
  payAmount: number | null = null;
  payMode: WholesalePaymentMode = 'CASH';
  payReference = '';
  payNotes = '';
  payNow = true;

  constructor(private wholesaleService: WholesaleService, private sanitizer: DomSanitizer) { }

  ngOnChanges(): void {
    if (!this.typeSettings.length) {
      this.wholesaleService.listDocumentSettings().subscribe({
        next: list => { this.typeSettings = list; this.computeAgainstOptions(); },
        error: () => {}
      });
    }
    this.error = '';
    this.message = '';
    this.showPaymentForm = false;
    this.wholesaleService.getSalesDocument(this.documentId).subscribe({
      next: d => this.setDoc(d),
      error: err => this.error = err.error?.message || err.message
    });
  }

  private computeAgainstOptions(): void {
    const d = this.doc;
    this.againstOptions = !d || !['ISSUED', 'PARTIALLY_PAID', 'PAID'].includes(d.status) ? [] : this.typeSettings
      .filter(s => s.docType !== 'QUOTATION' && s.referenceMode !== 'NONE' && (s.allowedReferenceTypes || []).includes(d.docType))
      .map(s => ({ type: s.docType as WholesaleSalesDocumentType, label: s.displayLabel || s.docType }));
  }

  eventLabel(type: string): string {
    const t = type.toLowerCase().split('_').join(' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  get isCredit(): boolean {
    return this.doc?.semantics?.valueEffect === 'CREDIT';
  }

  openReference(): void {
    const r = this.doc?.reference;
    if (r?.documentId) this.openDocument.emit(r.documentId);
    else if (r?.quotationId) this.openQuotation.emit(r.quotationId);
  }

  private setDoc(d: WholesaleSalesDocument): void {
    this.doc = d;
    this.computeAgainstOptions();
    this.view = salesDocumentView(d);
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(tradeDocumentHtml(this.view));
  }

  can(action: string): boolean {
    return !!this.doc?.allowedActions.includes(action);
  }

  get recordedPayments(): WholesalePaymentRecord[] {
    return (this.doc?.payments || []).filter(p => p.status === 'RECORDED');
  }

  // ── Issue / payments ─────────────────────────────────────

  openIssue(): void {
    this.issuing = true;
    this.openPaymentForm();
    this.payAmount = null; // empty = full amount
  }

  openPaymentForm(): void {
    if (!this.doc) return;
    this.showPaymentForm = true;
    this.payDate = this.doc.documentDate > this.today ? this.doc.documentDate : this.today;
    this.payAmount = Number(this.doc.payment.balanceDue) || null;
    this.payMode = 'CASH';
    this.payReference = '';
    this.payNotes = '';
    this.payNow = true;
    this.error = '';
  }

  closePaymentForm(): void {
    this.showPaymentForm = false;
    this.issuing = false;
  }

  private validatePayment(amount: number): string {
    const d = this.doc!;
    const balance = Number(this.issuing ? d.totals.grandTotal : d.payment.balanceDue);
    if (!(amount > 0)) return 'Enter an amount greater than 0.';
    if (amount > balance) return `Amount cannot be more than the balance due (₹${balance.toFixed(2)}).`;
    if (!this.payDate) return 'Enter the payment date.';
    if (this.payDate > this.today) return 'Payment date cannot be in the future.';
    if (this.payDate < d.documentDate) return 'Payment date cannot be before the document date.';
    return '';
  }

  submitPayment(): void {
    if (!this.doc) return;
    const d = this.doc;
    const recordPayment = !this.issuing || this.payNow;
    const amount = this.payAmount !== null && (this.payAmount as any) !== ''
      ? Number(this.payAmount) : Number(this.issuing ? d.totals.grandTotal : d.payment.balanceDue);
    if (recordPayment) {
      this.error = this.validatePayment(amount);
      if (this.error) return;
    }
    const payment = recordPayment ? {
      paymentDate: this.payDate, amount, paymentMode: this.payMode,
      reference: this.payReference.trim() || null, notes: this.payNotes.trim() || null
    } : null;

    if (this.issuing) {
      if (!confirm(`Issue ${d.documentNumber}? A number will be assigned, the quantities will be taken out of wholesale stock and it can no longer be edited.`)) return;
      this.run(this.wholesaleService.issueSalesDocument(d.salesDocumentId, payment), x => `${x.docTypeLabel} ${x.documentNumber} issued.`);
    } else {
      this.run(this.wholesaleService.addSalesPayment(d.salesDocumentId, payment!),
        x => `Payment of ₹${amount.toFixed(2)} recorded — ${salesStatusLabel(x.status).toLowerCase()}.`);
    }
  }

  voidPayment(p: WholesalePaymentRecord): void {
    if (!this.doc) return;
    const reason = prompt(`Void the ₹${Number(p.amount).toFixed(2)} payment of ${p.paymentDate}? It stays in the history as voided.\nReason (required):`, '');
    if (reason === null) return;
    if (!reason.trim()) { this.error = 'A reason is required to void a payment.'; return; }
    this.run(this.wholesaleService.voidSalesPayment(this.doc.salesDocumentId, p.paymentId, reason.trim()), () => 'Payment voided.');
  }

  // ── Draft actions ────────────────────────────────────────

  deleteDraft(): void {
    if (!this.doc || !confirm(`Delete ${this.doc.documentNumber}? This cannot be undone.`)) return;
    this.busy = 'action';
    this.wholesaleService.deleteSalesDocumentDraft(this.doc.salesDocumentId).subscribe({
      next: () => { this.busy = ''; this.deleted.emit(); },
      error: err => { this.busy = ''; this.error = err.error?.message || err.message; }
    });
  }

  cancelDocument(): void {
    if (!this.doc) return;
    const d = this.doc;
    const stockNote = d.status === 'DRAFT' ? '' : 'Its quantities go back into wholesale stock. ';
    const refundNote = Number(d.payment.amountPaid) > 0 ? `₹${Number(d.payment.amountPaid).toFixed(2)} has been received — refund it outside the system. ` : '';
    const reason = prompt(`Cancel ${d.docTypeLabel} ${d.documentNumber}?\n${stockNote}${refundNote}\nReason (required):`, '');
    if (reason === null) return;
    if (!reason.trim()) { this.error = 'A reason is required to cancel.'; return; }
    this.run(this.wholesaleService.cancelSalesDocument(d.salesDocumentId, reason.trim()), x => `${x.docTypeLabel} ${x.documentNumber} cancelled.`);
  }

  // ── Output ───────────────────────────────────────────────

  /** compact = 80 mm thermal / compact layout. */
  print(compact = false): void {
    if (this.view) printView(this.view, compact);
  }

  async downloadPdf(): Promise<void> {
    if (!this.view) return;
    this.busy = 'pdf';
    try { await downloadViewPdf(this.view); }
    catch (e) { this.error = 'Could not create the PDF: ' + ((e as Error)?.message || e); }
    finally { this.busy = ''; }
  }

  async share(): Promise<void> {
    if (!this.view) return;
    this.busy = 'share';
    try {
      const r = await shareView(this.view);
      this.message = r === 'whatsapp' ? 'PDF downloaded and WhatsApp opened — attach the PDF to the chat.'
        : r === 'copied' ? 'PDF downloaded and the summary copied to the clipboard.' : r === 'shared' ? 'Shared.' : '';
    } catch (e) {
      this.error = 'Could not share: ' + ((e as Error)?.message || e);
    } finally {
      this.busy = '';
    }
  }

  private run(call: Observable<WholesaleSalesDocument>, success: (d: WholesaleSalesDocument) => string): void {
    this.busy = 'action';
    this.error = '';
    call.subscribe({
      next: d => {
        this.busy = '';
        this.closePaymentForm();
        this.setDoc(d);
        this.message = [success(d), ...(d.warnings || [])].join(' ');
        this.changed.emit(d);
      },
      error: err => { this.busy = ''; this.error = err.error?.message || err.message; }
    });
  }
}
