import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, Subscription, debounceTime, switchMap, of, catchError } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import {
  WholesaleCustomer, WholesaleDocumentSettings, WholesalePaymentMode, WholesalePriceQuote, WholesaleProduct,
  WholesaleQuotationItemRequest, WholesaleQuotationRequest, WholesaleQuotationSummary, WholesaleQuotationTotals,
  WholesaleSalesDocumentRequest, WholesaleSalesDocumentSummary, WholesaleSalesDocumentType
} from '../wholesale.model';

export type WholesaleEditorKind = 'QUOTATION' | WholesaleSalesDocumentType;
type ReferenceKind = 'NONE' | 'DOCUMENT' | 'QUOTATION' | 'EXTERNAL';
const DEFAULT_LABELS: Record<string, string> = {
  QUOTATION: 'Quotation', SALES_RECEIPT: 'Sales Receipt', CREDIT_NOTE: 'Credit Note', DEBIT_NOTE: 'Debit Note'
};

/** What both a quotation and a sales receipt return from preview / save (structurally shared). */
interface EditorDocument {
  items: { wholesaleProductId: number; itemName: string; quantity: number; rate: number; rateSource: string;
           discountPct: number; gstPct: number; description?: string | null; taxableAmount: number;
           gstAmount: number; totalAmount: number }[];
  totals: WholesaleQuotationTotals;
  interstate: boolean;
  warnings: string[];
  notes?: string | null;
  terms?: string | null;
  customer: { wholesaleCustomerId: number };
  status: string;
}

export interface WholesaleEditorSaved { id: number; displayNumber: string; status: string; }
import { WholesaleCustomerPickerComponent } from '../wholesale-customer-picker/wholesale-customer-picker.component';

/**
 * Draft editor for wholesale quotations and sales receipts (kind input). Both use the same slab pricing:
 * select product → enter quantity → slab price looked up → review/override → server calculates GST and totals.
 *
 * Editor line. rateMode AUTO = the server applies the quantity price rule on save (rate shown is the looked-up
 * slab price); FIXED = the rate typed by the user, or the rate already saved on this draft (kept as-is, so later
 * price-rule changes never alter a saved quotation).
 */
interface EditorLine {
  product: WholesaleProduct | null;
  search: string;
  quantity: number | null;
  rateMode: 'AUTO' | 'FIXED';
  rate: number | null;
  suggestion: WholesalePriceQuote | null;
  suggestionError: string;
  discountPct: number | null;
  /** null = automatic (slab GST, else product GST). */
  gstPct: number | null;
  description: string;
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

@Component({
  selector: 'app-wholesale-quotation-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, WholesaleCustomerPickerComponent],
  templateUrl: './wholesale-quotation-editor.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-quotation-editor.component.css']
})
export class WholesaleQuotationEditorComponent implements OnInit, OnDestroy {
  @Input() kind: WholesaleEditorKind = 'QUOTATION';
  /** null = new document; otherwise the DRAFT to edit. */
  @Input() documentId: number | null = null;
  /** New Credit/Debit Note against an existing document: customer, reference and items are pre-filled from it. */
  @Input() prefillReferenceId: number | null = null;
  @Output() saved = new EventEmitter<WholesaleEditorSaved>();
  @Output() cancelled = new EventEmitter<void>();

  products: WholesaleProduct[] = [];
  customer: WholesaleCustomer | null = null;
  quotationDate = today();
  validUntil = '';
  validityDays = 15;
  otherChargesLabel = '';
  otherChargesAmount: number | null = null;
  otherChargesGstPct: number | null = null;
  notes = '';
  terms = '';
  lines: EditorLine[] = [];
  openDropdown = -1;

  preview: EditorDocument | null = null;

  // Sales receipt: payment received at issue
  readonly paymentModes: { value: WholesalePaymentMode; label: string }[] = [
    { value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' },
    { value: 'CARD', label: 'Card' }, { value: 'CHEQUE', label: 'Cheque' }
  ];
  payNow = true;
  payAmount: number | null = null;
  payMode: WholesalePaymentMode = 'CASH';
  payReference = '';
  readonly today = today();

  // Document-type configuration (labels, reference + reason rules) and the reference being entered.
  typeSettings: WholesaleDocumentSettings | null = null;
  reason = '';
  dueDate = '';
  refKind: ReferenceKind = 'NONE';
  refDocumentId: number | null = null;
  refQuotationId: number | null = null;
  extNumber = '';
  extDate = '';
  refDocs: WholesaleSalesDocumentSummary[] = [];
  refQuotes: WholesaleQuotationSummary[] = [];
  previewError = '';
  previewing = false;
  error = '';
  saving = false;
  loading = false;
  displayNumber = '';

  private preview$ = new Subject<void>();
  private subs: Subscription[] = [];

  constructor(private wholesaleService: WholesaleService) { }

  ngOnInit(): void {
    this.subs.push(this.preview$.pipe(
      debounceTime(400),
      switchMap(() => {
        const request = this.buildRequest(true);
        if (!request) { this.preview = null; this.previewError = ''; return of(null); }
        this.previewing = true;
        const call: Observable<EditorDocument> = this.isSalesDoc
          ? this.wholesaleService.previewSalesDocument(request as WholesaleSalesDocumentRequest)
          : this.wholesaleService.previewQuotation(request as WholesaleQuotationRequest);
        return call.pipe(catchError(err => {
          this.previewError = err.error?.message || err.message;
          return of(null);
        }));
      })
    ).subscribe(result => {
      this.previewing = false;
      if (result) { this.preview = result; this.previewError = ''; }
    }));

    this.wholesaleService.getProducts().subscribe({
      next: list => {
        this.products = list;
        if (this.documentId) this.loadDraft(this.documentId);
      },
      error: err => this.error = 'Could not load wholesale products: ' + (err.error?.message || err.message)
    });

    this.wholesaleService.getDocumentSettings(this.kind).subscribe({
      next: s => {
        this.typeSettings = s;
        if (this.documentId) return;
        this.validityDays = s.defaultValidityDays;
        this.validUntil = addDays(this.quotationDate, s.defaultValidityDays);
        this.terms = s.defaultTerms || '';
        this.applyDefaultDueDate();
        if (this.referenceAllowed && this.refKind === 'NONE' && s.referenceMode === 'REQUIRED') {
          this.refKind = this.allowsDocuments ? 'DOCUMENT' : 'EXTERNAL';
        }
      },
      error: () => this.validUntil = addDays(this.quotationDate, this.validityDays)
    });
    if (!this.documentId) {
      this.addLine();
      if (this.prefillReferenceId) this.prefillFromReference(this.prefillReferenceId);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get isReceipt(): boolean {
    return this.kind === 'SALES_RECEIPT';
  }

  /** Sales Receipt, Credit Note or Debit Note (anything but a quotation). */
  get isSalesDoc(): boolean {
    return this.kind !== 'QUOTATION';
  }

  get docLabel(): string {
    return this.typeSettings?.displayLabel || DEFAULT_LABELS[this.kind];
  }

  get isCredit(): boolean {
    return this.typeSettings?.valueEffect === 'CREDIT';
  }

  /** Payable documents other than Sales Receipts carry a due date. */
  get hasDueDate(): boolean {
    return this.isSalesDoc && !this.isReceipt && !this.isCredit;
  }

  get referenceAllowed(): boolean {
    return this.isSalesDoc && !!this.typeSettings && this.typeSettings.referenceMode !== 'NONE';
  }

  get allowsDocuments(): boolean {
    return (this.typeSettings?.allowedReferenceTypes || []).some(t => t !== 'QUOTATION');
  }

  get allowsQuotations(): boolean {
    return (this.typeSettings?.allowedReferenceTypes || []).includes('QUOTATION');
  }

  get reasonRequired(): boolean {
    return !!this.typeSettings?.reasonRequired;
  }

  private applyDefaultDueDate(): void {
    if (this.hasDueDate && this.quotationDate) {
      this.dueDate = addDays(this.quotationDate, this.typeSettings?.defaultDueDays ?? 30);
    }
  }

  /** Candidate reference documents/quotations of the selected customer (active, allowed types). */
  loadReferenceCandidates(): void {
    this.refDocs = [];
    this.refQuotes = [];
    if (!this.referenceAllowed || !this.customer) return;
    const customerId = this.customer.wholesaleCustomerId;
    const types = (this.typeSettings!.allowedReferenceTypes || []).filter(t => t !== 'QUOTATION');
    if (types.length) {
      this.wholesaleService.getSalesDocuments({ type: types.join(','), status: 'ISSUED,PARTIALLY_PAID,PAID' }).subscribe(list =>
        this.refDocs = list.filter(d => d.wholesaleCustomerId === customerId && d.salesDocumentId !== this.documentId));
    }
    if (this.allowsQuotations) {
      this.wholesaleService.getQuotations({ status: 'ISSUED,ACCEPTED,CONVERTED' }).subscribe(list =>
        this.refQuotes = list.filter(q => q.wholesaleCustomerId === customerId));
    }
  }

  onReferenceChange(): void {
    this.schedulePreview();
  }

  /** Copies customer, reference and lines (with their original rates) from an existing document. */
  private prefillFromReference(id: number): void {
    this.wholesaleService.getSalesDocument(id).subscribe({
      next: ref => {
        this.refKind = 'DOCUMENT';
        this.refDocumentId = ref.salesDocumentId;
        this.lines = ref.items.map(i => this.lineFromItem(i));
        this.wholesaleService.getCustomer(ref.customer.wholesaleCustomerId).subscribe(c => {
          this.customer = c;
          this.loadReferenceCandidates();
          this.schedulePreview();
        });
      },
      error: err => this.error = 'Could not load the referenced document: ' + (err.error?.message || err.message)
    });
  }

  copyItemsFromReference(): void {
    const apply = (items: EditorDocument['items']) => { this.lines = items.map(i => this.lineFromItem(i)); this.schedulePreview(); };
    if (this.refKind === 'DOCUMENT' && this.refDocumentId) {
      this.wholesaleService.getSalesDocument(this.refDocumentId).subscribe(d => apply(d.items));
    } else if (this.refKind === 'QUOTATION' && this.refQuotationId) {
      this.wholesaleService.getQuotation(this.refQuotationId).subscribe(q => apply(q.items));
    }
  }

  private loadDraft(id: number): void {
    this.loading = true;
    const call: Observable<EditorDocument & { displayNumber?: string; documentNumber?: string }> = this.isSalesDoc
      ? this.wholesaleService.getSalesDocument(id)
      : this.wholesaleService.getQuotation(id);
    call.subscribe({
      next: q => {
        this.loading = false;
        if (q.status !== 'DRAFT') { this.error = `Only draft ${this.docLabel.toLowerCase()}s can be edited.`; return; }
        this.displayNumber = (q.displayNumber || q.documentNumber || '');
        if (this.isSalesDoc) {
          const d = q as any;
          this.quotationDate = d.documentDate;
          this.reason = d.reason || '';
          this.dueDate = d.payment?.dueDate || '';
          const ref = d.reference;
          if (ref) {
            this.refKind = ref.docType === 'EXTERNAL' ? 'EXTERNAL' : ref.docType === 'QUOTATION' ? 'QUOTATION' : 'DOCUMENT';
            this.refDocumentId = ref.documentId ?? null;
            this.refQuotationId = ref.quotationId ?? null;
            if (ref.docType === 'EXTERNAL') { this.extNumber = ref.number; this.extDate = ref.date || ''; }
          }
        } else {
          this.quotationDate = (q as any).quotationDate;
          this.validUntil = (q as any).validUntil;
        }
        this.otherChargesLabel = q.totals.otherChargesLabel || '';
        this.otherChargesAmount = Number(q.totals.otherChargesAmount) || null;
        this.otherChargesGstPct = Number(q.totals.otherChargesGstPct) || null;
        this.notes = q.notes || '';
        this.terms = q.terms || '';
        this.lines = q.items.map(i => this.lineFromItem(i));
        this.wholesaleService.getCustomer(q.customer.wholesaleCustomerId).subscribe({
          next: c => { this.customer = c; this.loadReferenceCandidates(); this.schedulePreview(); },
          error: () => this.error = 'The customer on this draft could not be loaded.'
        });
      },
      error: err => { this.loading = false; this.error = err.error?.message || err.message; }
    });
  }

  private lineFromItem(i: EditorDocument['items'][number]): EditorLine {
    const product = this.products.find(p => p.wholesaleProductId === i.wholesaleProductId) || null;
    return {
      product, search: product ? this.productLabel(product) : i.itemName, quantity: Number(i.quantity),
      rateMode: 'FIXED', rate: Number(i.rate), suggestion: null, suggestionError: '',
      discountPct: Number(i.discountPct) || null, gstPct: Number(i.gstPct), description: i.description || ''
    };
  }

  // ── Header ───────────────────────────────────────────────

  onCustomerChange(c: WholesaleCustomer | null): void {
    this.customer = c;
    this.refDocumentId = null;
    this.refQuotationId = null;
    this.loadReferenceCandidates();
    this.schedulePreview();
  }

  onQuotationDateChange(): void {
    if (this.hasDueDate && (!this.dueDate || this.dueDate < this.quotationDate)) this.applyDefaultDueDate();
    if (!this.isSalesDoc && this.quotationDate && (!this.validUntil || this.validUntil < this.quotationDate)) {
      this.validUntil = addDays(this.quotationDate, this.validityDays);
    }
    this.lines.filter(l => l.rateMode === 'AUTO').forEach(l => this.lookupPrice(l));
    this.schedulePreview();
  }

  get validityDaysLabel(): string {
    if (!this.quotationDate || !this.validUntil) return '';
    const days = Math.round((new Date(this.validUntil).getTime() - new Date(this.quotationDate).getTime()) / 86400000);
    return days >= 0 ? `${days} day${days === 1 ? '' : 's'}` : '';
  }

  // ── Lines ────────────────────────────────────────────────

  addLine(): void {
    this.lines.push({ product: null, search: '', quantity: null, rateMode: 'AUTO', rate: null, suggestion: null,
      suggestionError: '', discountPct: null, gstPct: null, description: '' });
  }

  /** "+ Add item": adds a row and puts the cursor in its product search (saves a tap on phones). */
  addLineAndFocus(): void {
    this.addLine();
    this.focusField('qeProd' + (this.lines.length - 1));
  }

  private focusField(id: string): void {
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (!el) return;
      el.focus();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  removeLine(index: number): void {
    this.lines.splice(index, 1);
    this.schedulePreview();
  }

  productLabel(p: WholesaleProduct): string {
    return p.productCode ? `${p.productName} [${p.productCode}]` : p.productName;
  }

  filteredProducts(line: EditorLine): WholesaleProduct[] {
    const term = line.search.toLowerCase().trim();
    return this.products.filter(p => p.isActive && (!term
      || p.productName.toLowerCase().includes(term)
      || (p.productCode || '').toLowerCase().includes(term)
      || (p.hsnCode || '').includes(term))).slice(0, 50);
  }

  selectProduct(line: EditorLine, p: WholesaleProduct): void {
    line.product = p;
    line.search = this.productLabel(p);
    line.rateMode = 'AUTO';
    line.gstPct = null;
    this.openDropdown = -1;
    this.lookupPrice(line);
    this.schedulePreview();
    if (line.quantity == null) this.focusField('qeQty' + this.lines.indexOf(line));
  }

  onSearchInput(line: EditorLine): void {
    if (line.product && line.search !== this.productLabel(line.product)) {
      line.product = null;
      line.suggestion = null;
      line.suggestionError = '';
    }
  }

  onSearchBlur(): void {
    setTimeout(() => this.openDropdown = -1, 200);
  }

  onQuantityChange(line: EditorLine): void {
    if (line.rateMode === 'AUTO' || line.suggestion) this.lookupPrice(line);
    this.schedulePreview();
  }

  onRateInput(line: EditorLine): void {
    line.rateMode = 'FIXED';
    this.schedulePreview();
  }

  useSlabPrice(line: EditorLine): void {
    line.rateMode = 'AUTO';
    this.lookupPrice(line);
    this.schedulePreview();
  }

  /** Step 3 of the flow: ask the server which quantity slab applies and show its rate for review. */
  lookupPrice(line: EditorLine): void {
    line.suggestionError = '';
    if (!line.product || !(Number(line.quantity) > 0)) { line.suggestion = null; return; }
    this.wholesaleService.getPrice(line.product.wholesaleProductId, Number(line.quantity), false, this.quotationDate).subscribe({
      next: q => {
        line.suggestion = q;
        if (line.rateMode === 'AUTO') line.rate = Number(q.unitPrice);
      },
      error: err => {
        line.suggestion = null;
        line.suggestionError = err.status === 404
          ? 'No price slab covers this quantity — enter a rate.'
          : (err.error?.message || err.message);
        if (line.rateMode === 'AUTO') line.rate = null;
      }
    });
  }

  slabLabel(s: WholesalePriceQuote): string {
    const range = s.maxQuantity === null || s.maxQuantity === undefined ? `${s.minQuantity}+` : `${s.minQuantity}–${s.maxQuantity}`;
    return `Slab ${range} ${s.unit}: ₹${Number(s.unitPrice).toFixed(2)}`;
  }

  rateDiffersFromSlab(line: EditorLine): boolean {
    return !!line.suggestion && line.rate !== null && Number(line.rate) !== Number(line.suggestion.unitPrice);
  }

  result(index: number): EditorDocument['items'][number] | null {
    return this.preview?.items[index] ?? null;
  }

  // ── Request / save ───────────────────────────────────────

  schedulePreview(): void {
    this.preview$.next();
  }

  /** forPreview: silently returns null if not yet complete instead of reporting an error. */
  buildRequest(forPreview = false): WholesaleQuotationRequest | WholesaleSalesDocumentRequest | null {
    const problem = this.validate();
    if (problem) {
      if (!forPreview) this.error = problem;
      return null;
    }
    const num = (v: number | null) => v === null || v === undefined || (v as any) === '' ? null : Number(v);
    const items: WholesaleQuotationItemRequest[] = this.lines.map(l => ({
      wholesaleProductId: l.product!.wholesaleProductId,
      quantity: Number(l.quantity),
      rate: l.rateMode === 'FIXED' ? Number(l.rate) : null,
      discountPct: num(l.discountPct),
      gstPct: num(l.gstPct),
      description: l.description.trim() || null
    }));
    const common = {
      customerId: this.customer!.wholesaleCustomerId,
      otherChargesLabel: this.otherChargesLabel.trim() || null,
      otherChargesAmount: num(this.otherChargesAmount),
      otherChargesGstPct: num(this.otherChargesGstPct),
      notes: this.notes.trim() || null,
      terms: this.terms.trim() || null,
      items
    };
    if (!this.isSalesDoc) return { ...common, quotationDate: this.quotationDate, validUntil: this.validUntil || null };
    return {
      ...common,
      docType: this.kind as WholesaleSalesDocumentType,
      documentDate: this.quotationDate,
      referenceDocumentId: this.refKind === 'DOCUMENT' ? this.refDocumentId : null,
      referenceQuotationId: this.refKind === 'QUOTATION' ? this.refQuotationId : null,
      externalReferenceNumber: this.refKind === 'EXTERNAL' ? (this.extNumber.trim() || null) : null,
      externalReferenceDate: this.refKind === 'EXTERNAL' ? (this.extDate || null) : null,
      reason: this.reason.trim() || null,
      dueDate: this.hasDueDate ? (this.dueDate || null) : null
    };
  }

  validate(): string {
    if (!this.customer) return 'Select a customer.';
    if (!this.quotationDate) return `Enter the ${this.isReceipt ? 'receipt' : 'quotation'} date.`;
    if (this.isSalesDoc && this.quotationDate > this.today) return 'The date cannot be in the future.';
    if (!this.isSalesDoc && this.validUntil && this.validUntil < this.quotationDate) return 'Valid-until date cannot be before the quotation date.';
    if (this.isSalesDoc) {
      const mode = this.typeSettings?.referenceMode;
      if (mode === 'REQUIRED' && this.refKind === 'NONE') return `A ${this.docLabel} must reference the original document.`;
      if (this.refKind === 'DOCUMENT' && !this.refDocumentId) return 'Select the referenced document.';
      if (this.refKind === 'QUOTATION' && !this.refQuotationId) return 'Select the referenced quotation.';
      if (this.refKind === 'EXTERNAL' && (!this.extNumber.trim() || !this.extDate)) return 'Enter the external invoice number and date.';
      if (this.refKind === 'EXTERNAL' && this.extDate > this.quotationDate) return 'The referenced invoice cannot be dated after this document.';
      if (this.reasonRequired && !this.reason.trim()) return `Enter a reason for this ${this.docLabel}.`;
      if (this.hasDueDate && this.dueDate && this.dueDate < this.quotationDate) return 'Due date cannot be before the document date.';
    }
    if (this.lines.length === 0) return 'Add at least one item.';
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      const n = i + 1;
      if (!l.product) return `Item ${n}: select a wholesale product.`;
      if (!(Number(l.quantity) > 0)) return `Item ${n}: enter a quantity greater than 0.`;
      if (l.rateMode === 'FIXED' && (l.rate === null || (l.rate as any) === '' || Number(l.rate) < 0)) return `Item ${n}: enter a rate.`;
      if (l.rateMode === 'AUTO' && l.suggestionError) return `Item ${n}: no price slab covers this quantity — enter a rate.`;
      const d = Number(l.discountPct || 0);
      if (d < 0 || d > 100) return `Item ${n}: discount must be between 0 and 100%.`;
      if (l.gstPct !== null && (l.gstPct as any) !== '' && (Number(l.gstPct) < 0 || Number(l.gstPct) > 100)) return `Item ${n}: GST % must be 0–100.`;
    }
    if (this.otherChargesAmount !== null && Number(this.otherChargesAmount) < 0) return 'Other charges cannot be negative.';
    return '';
  }

  /** Amount to record at issue (receipts): the typed amount, else the grand total from the preview. */
  get paymentAmountNow(): number {
    return this.payAmount !== null && (this.payAmount as any) !== '' ? Number(this.payAmount) : Number(this.preview?.totals.grandTotal || 0);
  }

  save(issueAfterSave: boolean): void {
    if (this.saving) return;
    this.error = '';
    const request = this.buildRequest();
    if (!request) return;
    const recordPayment = this.isReceipt && issueAfterSave && this.payNow;
    if (recordPayment) {
      const amount = this.paymentAmountNow;
      if (!(amount > 0)) { this.error = 'Enter the amount received, or untick "Payment received now".'; return; }
      if (this.preview && amount > Number(this.preview.totals.grandTotal)) { this.error = 'Amount received cannot exceed the grand total.'; return; }
    }
    const stockNote = this.typeSettings?.stockEffect === 'OUT' ? ' The quantities will be taken out of wholesale stock.'
      : this.typeSettings?.stockEffect === 'IN' ? ' The quantities will be added back to wholesale stock.' : '';
    if (issueAfterSave && !confirm(this.isSalesDoc
      ? `Issue this ${this.docLabel}? A number will be assigned and it can no longer be edited.${stockNote}`
      : 'Issue this quotation? A quotation number will be assigned and it can no longer be edited.')) return;

    this.saving = true;
    const saveCall: Observable<{ id: number; displayNumber: string; status: string }> = this.isSalesDoc
      ? (this.documentId
          ? this.wholesaleService.updateSalesDocument(this.documentId, request as WholesaleSalesDocumentRequest)
          : this.wholesaleService.createSalesDocument(request as WholesaleSalesDocumentRequest))
          .pipe(switchMap(d => of({ id: d.salesDocumentId, displayNumber: d.documentNumber, status: d.status })))
      : (this.documentId
          ? this.wholesaleService.updateQuotation(this.documentId, request as WholesaleQuotationRequest)
          : this.wholesaleService.createQuotation(request as WholesaleQuotationRequest))
          .pipe(switchMap(q => of({ id: q.quotationId!, displayNumber: q.displayNumber, status: q.status })));

    saveCall.pipe(switchMap(doc => {
      // Remember the saved draft so a failed issue followed by a retry updates it instead of creating another.
      this.documentId = doc.id;
      this.displayNumber = doc.displayNumber;
      if (!issueAfterSave) return of(doc);
      if (this.isSalesDoc) {
        const payment = recordPayment ? {
          amount: this.paymentAmountNow, paymentMode: this.payMode, reference: this.payReference.trim() || null,
          paymentDate: this.quotationDate
        } : null;
        return this.wholesaleService.issueSalesDocument(doc.id, payment)
          .pipe(switchMap(d => of({ id: d.salesDocumentId, displayNumber: d.documentNumber, status: d.status })));
      }
      return this.wholesaleService.issueQuotation(doc.id)
        .pipe(switchMap(q => of({ id: q.quotationId!, displayNumber: q.displayNumber, status: q.status })));
    })).subscribe({
      next: doc => { this.saving = false; this.saved.emit(doc); },
      error: err => { this.saving = false; this.error = err.error?.message || err.message; }
    });
  }
}
