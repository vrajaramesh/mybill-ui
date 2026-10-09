import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject, Subscription, debounceTime } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import {
  WholesalePaymentMode, WholesaleQuotation, WholesaleQuotationAction, WholesaleQuotationStatus, WholesaleQuotationSummary,
  WholesaleSalesDocumentType
} from '../wholesale.model';
import { WholesaleEditorSaved, WholesaleQuotationEditorComponent } from '../wholesale-quotation-editor/wholesale-quotation-editor.component';
import { WholesaleSalesDocumentViewComponent } from '../wholesale-sales-document-view/wholesale-sales-document-view.component';
import { downloadViewPdf, printView, quotationHtml, quotationView, shareView } from '../wholesale-trade-documents';

type Mode = 'list' | 'view' | 'edit' | 'sales-doc';

const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

/** Wholesale Quotations: list, view (with print / PDF / share and status actions), create and edit drafts. */
@Component({
  selector: 'app-wholesale-quotations',
  standalone: true,
  imports: [CommonModule, FormsModule, WholesaleQuotationEditorComponent, WholesaleSalesDocumentViewComponent],
  templateUrl: './wholesale-quotations.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-quotations.component.css']
})
export class WholesaleQuotationsComponent implements OnInit, OnDestroy {
  readonly statuses: WholesaleQuotationStatus[] = ['DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED'];

  mode: Mode = 'list';
  quotations: WholesaleQuotationSummary[] = [];
  loading = false;
  listError = '';
  searchTerm = '';
  statusFilter = '';
  fromDate = '';
  toDate = '';
  private search$ = new Subject<void>();
  private sub?: Subscription;

  editId: number | null = null;
  current: WholesaleQuotation | null = null;
  previewHtml: SafeHtml | null = null;
  busy: '' | 'action' | 'pdf' | 'share' = '';
  message = '';
  actionError = '';
  showDuplicateChoice = false;

  // Conversion
  readonly paymentModes: { value: WholesalePaymentMode; label: string }[] = [
    { value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' },
    { value: 'CARD', label: 'Card' }, { value: 'CHEQUE', label: 'Cheque' }
  ];
  showConvert = false;
  convertTo: WholesaleSalesDocumentType = 'SALES_RECEIPT';
  convertDate = todayIso();
  paymentMode: WholesalePaymentMode = 'CASH';
  paymentReference = '';
  /** null = full grand total. */
  amountReceived: number | null = null;
  dueDate = '';
  dueDays = 30;
  convertNotes = '';
  allowDuplicate = false;
  stockShortages: string[] = [];
  convertError = '';
  converting = false;
  salesDocId: number | null = null;
  readonly today = todayIso();

  constructor(private wholesaleService: WholesaleService, private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
    this.sub = this.search$.pipe(debounceTime(300)).subscribe(() => this.load());
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── List ─────────────────────────────────────────────────

  onFilterChange(): void {
    this.search$.next();
  }

  load(): void {
    this.loading = true;
    this.wholesaleService.getQuotations({ q: this.searchTerm.trim(), status: this.statusFilter, from: this.fromDate, to: this.toDate })
      .subscribe({
        next: list => { this.quotations = list; this.loading = false; this.listError = ''; },
        error: err => { this.loading = false; this.listError = 'Could not load quotations: ' + (err.error?.message || err.message); }
      });
  }

  statusLabel(s: string): string {
    return s.charAt(0) + s.slice(1).toLowerCase();
  }

  backToList(): void {
    this.mode = 'list';
    this.current = null;
    this.editId = null;
    this.load();
  }

  // ── Conversion ───────────────────────────────────────────

  get alreadyConverted(): boolean {
    return this.current?.conversionStatus === 'CONVERTED';
  }

  get activeConversionNumbers(): string {
    return (this.current?.conversions || []).filter(c => c.status !== 'CANCELLED').map(c => c.documentNumber).join(', ');
  }

  toggleConvert(): void {
    if (this.showConvert) this.showConvert = false;
    else this.openConvert();
  }

  openConvert(): void {
    if (!this.current) return;
    this.showConvert = true;
    this.showDuplicateChoice = false;
    this.convertTo = 'SALES_RECEIPT';
    this.convertDate = todayIso();
    this.paymentMode = 'CASH';
    this.paymentReference = '';
    this.amountReceived = null;
    this.convertNotes = '';
    this.allowDuplicate = false;
    this.convertError = '';
    this.wholesaleService.getDocumentSettings('CREDIT_NOTE').subscribe({
      next: s => { this.dueDays = s.defaultDueDays ?? 30; this.dueDate = addDays(this.convertDate, this.dueDays); },
      error: () => this.dueDate = addDays(this.convertDate, this.dueDays)
    });
    this.checkStock();
  }

  onConvertDateChange(): void {
    if (this.convertDate) this.dueDate = addDays(this.convertDate, this.dueDays);
  }

  /** Same check the server makes (all-or-nothing stock deduction), shown up front. */
  private checkStock(): void {
    const q = this.current!;
    this.stockShortages = [];
    this.wholesaleService.getProducts().subscribe(products => {
      const needed = new Map<number, number>();
      q.items.forEach(i => needed.set(i.wholesaleProductId, (needed.get(i.wholesaleProductId) || 0) + Number(i.quantity)));
      needed.forEach((qty, productId) => {
        const p = products.find(x => x.wholesaleProductId === productId);
        const available = p ? Number(p.availableQuantity) : 0;
        if (available < qty) {
          this.stockShortages.push(`${p?.productName || 'Product #' + productId}: needs ${qty} ${p?.unit || ''}, only ${available} in stock`);
        }
      });
    });
  }

  validateConvert(): string {
    const q = this.current!;
    if (!this.convertDate) return 'Enter the document date.';
    if (this.convertDate > this.today) return 'Document date cannot be in the future.';
    if (this.convertDate < q.quotationDate) return 'Document date cannot be before the quotation date.';
    if (this.convertTo === 'SALES_RECEIPT' && !this.paymentMode) return 'Choose how the customer paid.';
    if (this.convertTo === 'SALES_RECEIPT' && this.amountReceived !== null && (this.amountReceived as any) !== ''
        && (Number(this.amountReceived) < 0 || Number(this.amountReceived) > Number(q.totals.grandTotal)))
      return 'Amount received must be between 0 and the grand total.';
    if (this.convertTo === 'CREDIT_NOTE' && (!this.dueDate || this.dueDate < this.convertDate)) return 'Due date must be on or after the document date.';
    if (this.alreadyConverted && !this.allowDuplicate) return `Already converted (${this.activeConversionNumbers}). Tick "convert again" to create another document.`;
    if (this.stockShortages.length) return 'Not enough wholesale stock for this conversion.';
    return '';
  }

  submitConvert(): void {
    const q = this.current;
    if (!q || this.converting) return;
    this.convertError = this.validateConvert();
    if (this.convertError) return;
    const label = this.convertTo === 'SALES_RECEIPT' ? 'Sales Receipt' : 'Credit Note';
    if (!confirm(`Convert ${q.displayNumber} into a ${label}?\nThe quoted rates and totals are copied unchanged and the quantities are taken out of wholesale stock.`)) return;
    this.converting = true;
    this.wholesaleService.convertQuotation(q.quotationId!, {
      convertTo: this.convertTo,
      documentDate: this.convertDate,
      paymentMode: this.convertTo === 'SALES_RECEIPT' ? this.paymentMode : null,
      paymentReference: this.convertTo === 'SALES_RECEIPT' ? (this.paymentReference.trim() || null) : null,
      amountReceived: this.convertTo === 'SALES_RECEIPT' && this.amountReceived !== null && (this.amountReceived as any) !== ''
        ? Number(this.amountReceived) : null,
      dueDate: this.convertTo === 'CREDIT_NOTE' ? this.dueDate : null,
      notes: this.convertNotes.trim() || null,
      allowDuplicate: this.allowDuplicate
    }).subscribe({
      next: doc => {
        this.converting = false;
        this.showConvert = false;
        this.message = `${doc.docTypeLabel} ${doc.documentNumber} created from ${q.displayNumber}.`;
        this.openSalesDocument(doc.salesDocumentId);
      },
      error: err => { this.converting = false; this.convertError = err.error?.message || err.message; }
    });
  }

  openSalesDocument(id: number): void {
    this.salesDocId = id;
    this.mode = 'sales-doc';
  }

  backToQuotation(): void {
    if (this.current) this.open(this.current.quotationId!);
    else this.backToList();
  }

  // ── Create / edit ────────────────────────────────────────

  newQuotation(): void {
    this.editId = null;
    this.mode = 'edit';
  }

  onSaved(q: WholesaleEditorSaved): void {
    this.open(q.id);
    this.message = q.status === 'ISSUED' ? `Quotation ${q.displayNumber} issued.` : `${q.displayNumber} saved.`;
  }

  onEditorCancelled(): void {
    if (this.current) this.mode = 'view';
    else this.backToList();
  }

  // ── View ─────────────────────────────────────────────────

  open(id: number): void {
    this.mode = 'view';
    this.message = '';
    this.actionError = '';
    this.showDuplicateChoice = false;
    this.showConvert = false;
    this.wholesaleService.getQuotation(id).subscribe({
      next: q => this.setCurrent(q),
      error: err => this.actionError = err.error?.message || err.message
    });
  }

  private setCurrent(q: WholesaleQuotation): void {
    this.current = q;
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(quotationHtml(q));
  }

  can(action: WholesaleQuotationAction): boolean {
    return !!this.current?.allowedActions.includes(action);
  }

  edit(): void {
    if (!this.current) return;
    this.editId = this.current.quotationId;
    this.mode = 'edit';
  }

  issue(): void {
    if (!this.current || !confirm('Issue this quotation? A number will be assigned and it can no longer be edited.')) return;
    this.runAction(this.wholesaleService.issueQuotation(this.current.quotationId!), q => `Quotation ${q.displayNumber} issued.`);
  }

  setStatus(status: 'ACCEPTED' | 'REJECTED'): void {
    if (!this.current || !confirm(`Mark ${this.current.displayNumber} as ${status.toLowerCase()}?`)) return;
    this.runAction(this.wholesaleService.changeQuotationStatus(this.current.quotationId!, status), () => `Marked ${status.toLowerCase()}.`);
  }

  cancelQuotation(): void {
    if (!this.current) return;
    const reason = prompt(`Cancel ${this.current.displayNumber}? Enter a reason (optional):`, '');
    if (reason === null) return;
    this.runAction(this.wholesaleService.changeQuotationStatus(this.current.quotationId!, 'CANCELLED', reason), () => 'Quotation cancelled.');
  }

  remove(): void {
    if (!this.current || !confirm(`Delete ${this.current.displayNumber}? This cannot be undone.`)) return;
    this.busy = 'action';
    this.wholesaleService.deleteQuotation(this.current.quotationId!).subscribe({
      next: () => { this.busy = ''; this.backToList(); },
      error: err => { this.busy = ''; this.actionError = err.error?.message || err.message; }
    });
  }

  duplicate(reprice: boolean): void {
    if (!this.current) return;
    this.showDuplicateChoice = false;
    this.busy = 'action';
    this.wholesaleService.duplicateQuotation(this.current.quotationId!, reprice).subscribe({
      next: copy => {
        this.busy = '';
        this.editId = copy.quotationId;
        this.current = copy;
        this.mode = 'edit';
      },
      error: err => { this.busy = ''; this.actionError = err.error?.message || err.message; }
    });
  }

  /** compact = 80 mm thermal / compact layout. */
  print(compact = false): void {
    if (this.current) printView(quotationView(this.current), compact);
  }

  async downloadPdf(): Promise<void> {
    if (!this.current) return;
    this.busy = 'pdf';
    this.actionError = '';
    try {
      await downloadViewPdf(quotationView(this.current));
    } catch (e) {
      this.actionError = 'Could not create the PDF: ' + ((e as Error)?.message || e);
    } finally {
      this.busy = '';
    }
  }

  async share(): Promise<void> {
    if (!this.current) return;
    this.busy = 'share';
    this.actionError = '';
    try {
      const result = await shareView(quotationView(this.current));
      this.message = result === 'whatsapp' ? 'PDF downloaded and WhatsApp opened — attach the PDF to the chat.'
        : result === 'copied' ? 'PDF downloaded and the quotation summary copied to the clipboard.'
        : result === 'shared' ? 'Shared.' : '';
    } catch (e) {
      this.actionError = 'Could not share: ' + ((e as Error)?.message || e);
    } finally {
      this.busy = '';
    }
  }

  private runAction(call: Observable<WholesaleQuotation>, success: (q: WholesaleQuotation) => string): void {
    this.busy = 'action';
    this.actionError = '';
    call.subscribe({
      next: q => { this.busy = ''; this.setCurrent(q); this.message = success(q); },
      error: err => { this.busy = ''; this.actionError = err.error?.message || err.message; }
    });
  }
}
