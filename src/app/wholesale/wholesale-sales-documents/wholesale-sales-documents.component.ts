import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import { WholesaleSalesDocumentSummary, WholesaleSalesDocumentType } from '../wholesale.model';
import { WholesaleSalesDocumentViewComponent } from '../wholesale-sales-document-view/wholesale-sales-document-view.component';
import { WholesaleEditorSaved, WholesaleQuotationEditorComponent } from '../wholesale-quotation-editor/wholesale-quotation-editor.component';
import { paymentModeLabel, salesStatusLabel } from '../wholesale-trade-documents';

/** Wholesale Sales Receipts (direct or from quotations) and Credit Notes (credit sales from quotations). */
@Component({
  selector: 'app-wholesale-sales-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, WholesaleSalesDocumentViewComponent, WholesaleQuotationEditorComponent],
  templateUrl: './wholesale-sales-documents.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-sales-documents.component.css']
})
export class WholesaleSalesDocumentsComponent implements OnInit, OnDestroy {
  documents: WholesaleSalesDocumentSummary[] = [];
  typeFilter: '' | WholesaleSalesDocumentType = '';
  /** Labels from the document-type configuration (business terminology). */
  typeLabels: Record<string, string> = { SALES_RECEIPT: 'Sales Receipt', CREDIT_NOTE: 'Credit Note', DEBIT_NOTE: 'Debit Note' };
  readonly docTypes: WholesaleSalesDocumentType[] = ['SALES_RECEIPT', 'CREDIT_NOTE', 'DEBIT_NOTE'];
  editKind: WholesaleSalesDocumentType = 'SALES_RECEIPT';
  prefillReferenceId: number | null = null;
  showNewMenu = false;
  readonly statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'ISSUED,PARTIALLY_PAID', label: 'Payment pending' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ISSUED', label: 'Unpaid' },
    { value: 'PARTIALLY_PAID', label: 'Partially paid' },
    { value: 'PAID', label: 'Paid' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];
  readonly statusLabel = salesStatusLabel;
  statusFilter = '';
  /** Editor: true = open; editId null = new receipt. */
  editing = false;
  editId: number | null = null;
  message = '';
  searchTerm = '';
  fromDate = '';
  toDate = '';
  loading = false;
  error = '';
  selectedId: number | null = null;
  private search$ = new Subject<void>();
  private sub?: Subscription;

  constructor(private wholesaleService: WholesaleService) { }

  ngOnInit(): void {
    this.wholesaleService.listDocumentSettings().subscribe({
      next: list => list.forEach(s => { if (s.displayLabel) this.typeLabels[s.docType] = s.displayLabel; }),
      error: () => {}
    });
    this.sub = this.search$.pipe(debounceTime(300)).subscribe(() => this.load());
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSearchChange(): void {
    this.search$.next();
  }

  setType(type: '' | WholesaleSalesDocumentType): void {
    this.typeFilter = type;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.wholesaleService.getSalesDocuments({
      type: this.typeFilter, status: this.statusFilter, q: this.searchTerm.trim(), from: this.fromDate, to: this.toDate
    }).subscribe({
      next: list => { this.documents = list; this.loading = false; this.error = ''; },
      error: err => { this.loading = false; this.error = 'Could not load sales documents: ' + (err.error?.message || err.message); }
    });
  }

  private get active() {
    return this.documents.filter(d => d.status !== 'DRAFT' && d.status !== 'CANCELLED');
  }

  get totalShown(): number {
    return this.active.reduce((sum, d) => sum + Number(d.grandTotal), 0);
  }

  get balanceShown(): number {
    return this.active.reduce((sum, d) => sum + Number(d.balanceDue), 0);
  }

  open(id: number): void {
    this.editing = false;
    this.selectedId = id;
  }

  back(): void {
    this.selectedId = null;
    this.editing = false;
    this.load();
  }

  newDocument(kind: WholesaleSalesDocumentType, referenceId: number | null = null): void {
    this.showNewMenu = false;
    this.message = '';
    this.selectedId = null;
    this.editId = null;
    this.editKind = kind;
    this.prefillReferenceId = referenceId;
    this.editing = true;
  }

  /** Edit a draft of any type; the view knows the type. */
  editDraft(id: number): void {
    this.wholesaleService.getSalesDocument(id).subscribe(d => {
      this.editKind = d.docType;
      this.prefillReferenceId = null;
      this.editId = id;
      this.editing = true;
    });
  }

  onCreateAgainst(e: { type: WholesaleSalesDocumentType; referenceId: number }): void {
    this.newDocument(e.type, e.referenceId);
  }

  onSaved(doc: WholesaleEditorSaved): void {
    this.editing = false;
    this.selectedId = doc.id;
    const label = this.typeLabels[this.editKind] || 'Document';
    this.message = doc.status === 'DRAFT' ? `${label} ${doc.displayNumber} saved as draft.` : `${label} ${doc.displayNumber} issued.`;
  }

  onEditorCancelled(): void {
    this.editing = false;
    if (this.selectedId === null) this.load();
  }

  onDeleted(): void {
    this.message = 'Draft deleted.';
    this.back();
  }

  /** Download the filtered list as CSV (opens in Excel / Google Sheets). */
  downloadCsv(): void {
    const header = ['Number', 'Type', 'Date', 'Customer', 'Business', 'Quotation', 'Status', 'Grand Total', 'Paid',
                    'Balance', 'Last Method', 'Due Date'];
    const rows = this.documents.map(d => [d.documentNumber, d.docTypeLabel, d.documentDate, d.customerName,
      d.customerBusinessName || '', d.sourceQuotationNumber || '', salesStatusLabel(d.status), Number(d.grandTotal).toFixed(2),
      Number(d.amountPaid).toFixed(2), Number(d.balanceDue).toFixed(2), paymentModeLabel(d.paymentMode), d.dueDate || '']);
    const escape = (v: string) => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const csv = [header, ...rows].map(r => r.map(c => escape(String(c))).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wholesale-sales-${new Date().toLocaleDateString('en-CA')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  isOverdue(d: WholesaleSalesDocumentSummary): boolean {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return (d.status === 'ISSUED' || d.status === 'PARTIALLY_PAID') && !!d.dueDate && d.dueDate < today;
  }
}
