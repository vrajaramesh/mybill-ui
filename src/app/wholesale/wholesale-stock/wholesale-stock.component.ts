import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import { AuthService } from '../../auth.service';
import {
  WholesaleCurrentStockRow, WholesaleInventorySettings, WholesaleLedgerEntry, WholesaleProduct,
  WholesaleProductStockHistory, WholesaleStockAdjustment, WholesaleStockMovementRow
} from '../wholesale.model';

type Tab = 'stock' | 'ledger' | 'movement' | 'adjustments';

interface AdjustmentLine { productId: number | null; quantityChange: number | null; notes: string; }

const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthStart = () => todayIso().substring(0, 8) + '01';

/** Wholesale Stock: current stock, stock ledger, stock movement, product history, adjustments. Separate from retail stock. */
@Component({
  selector: 'app-wholesale-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wholesale-stock.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-stock.component.css']
})
export class WholesaleStockComponent implements OnInit, OnDestroy {
  readonly transactionTypes = ['OPENING', 'PURCHASE', 'SALE', 'CREDIT', 'DEBIT', 'RETURN', 'ADJUSTMENT', 'REVERSAL'];
  readonly referenceTypes = [
    { value: 'PURCHASE', label: 'Purchase' }, { value: 'SALES_RECEIPT', label: 'Sales Receipt' },
    { value: 'CREDIT_NOTE', label: 'Credit Note' }, { value: 'DEBIT_NOTE', label: 'Debit Note' },
    { value: 'STOCK_ADJUSTMENT', label: 'Stock Adjustment' }
  ];
  readonly today = todayIso();

  tab: Tab = 'stock';
  error = '';
  message = '';
  isAdmin = false;
  products: WholesaleProduct[] = [];
  settings: WholesaleInventorySettings | null = null;

  // Current stock
  stock: WholesaleCurrentStockRow[] = [];
  stockSearch = '';
  includeInactive = false;
  onlyInStock = false;
  private search$ = new Subject<void>();
  private sub?: Subscription;

  // Ledger
  ledger: WholesaleLedgerEntry[] = [];
  ledgerProductId: number | null = null;
  ledgerFrom = monthStart();
  ledgerTo = todayIso();
  ledgerType = '';
  ledgerRefType = '';
  ledgerRefNo = '';

  // Movement
  movements: WholesaleStockMovementRow[] = [];
  movFrom = monthStart();
  movTo = todayIso();
  movSearch = '';
  onlyMoved = true;

  // Product history panel
  history: WholesaleProductStockHistory | null = null;
  historyProductId: number | null = null;
  historyFrom = '';
  historyTo = todayIso();

  // Adjustments
  adjustments: WholesaleStockAdjustment[] = [];
  showAdjustmentForm = false;
  adjDate = todayIso();
  adjReason = '';
  adjLines: AdjustmentLine[] = [];
  saving = false;

  constructor(private wholesaleService: WholesaleService, private auth: AuthService) { }

  ngOnInit(): void {
    this.isAdmin = this.auth.isAdmin();
    this.wholesaleService.getProducts().subscribe({ next: p => this.products = p, error: () => {} });
    this.wholesaleService.getInventorySettings().subscribe({ next: s => this.settings = s, error: () => {} });
    this.sub = this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.loadStock();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  setTab(t: Tab): void {
    this.tab = t;
    this.error = '';
    this.reload();
  }

  onSearch(): void {
    this.search$.next();
  }

  reload(): void {
    if (this.tab === 'stock') this.loadStock();
    else if (this.tab === 'ledger') this.loadLedger();
    else if (this.tab === 'movement') this.loadMovements();
    else this.loadAdjustments();
  }

  private fail(err: any): void {
    this.error = err.error?.message || err.message;
  }

  // ── Current stock ────────────────────────────────────────

  loadStock(): void {
    this.wholesaleService.getCurrentStock(this.stockSearch.trim(), this.includeInactive, this.onlyInStock)
      .subscribe({ next: r => this.stock = r, error: e => this.fail(e) });
  }

  get stockValue(): number {
    return this.stock.reduce((s, r) => s + Number(r.stockValue), 0);
  }

  get outOfSync(): WholesaleCurrentStockRow[] {
    return this.stock.filter(r => !r.inSync);
  }

  // ── Ledger ───────────────────────────────────────────────

  loadLedger(): void {
    if (this.ledgerFrom && this.ledgerTo && this.ledgerTo < this.ledgerFrom) { this.error = "'To' date cannot be before 'from' date."; return; }
    this.error = '';
    this.wholesaleService.getStockLedger({
      productId: this.ledgerProductId, from: this.ledgerFrom, to: this.ledgerTo, type: this.ledgerType,
      referenceType: this.ledgerRefType, q: this.ledgerRefNo.trim()
    }).subscribe({ next: r => this.ledger = r, error: e => this.fail(e) });
  }

  refLabel(type: string): string {
    return this.referenceTypes.find(r => r.value === type)?.label || type;
  }

  typeLabel(type: string): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
  }

  downloadLedgerCsv(): void {
    const header = ['Ledger #', 'Date', 'Product', 'Code', 'Type', 'Document', 'Document No.', 'In', 'Out', 'Balance', 'Unit', 'Rate', 'By', 'Notes'];
    const rows = this.ledger.map(e => [e.ledgerId, e.transactionDate, e.productName, e.productCode || '', e.transactionType,
      this.refLabel(e.referenceType), e.referenceNumber || '', e.quantityIn, e.quantityOut, e.balanceQuantity, e.unit,
      e.rate ?? '', e.createdBy || '', e.notes || '']);
    const esc = (v: unknown) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wholesale-stock-ledger-${this.ledgerFrom || 'all'}-to-${this.ledgerTo || this.today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ── Movement ─────────────────────────────────────────────

  loadMovements(): void {
    if (this.movFrom && this.movTo && this.movTo < this.movFrom) { this.error = "'To' date cannot be before 'from' date."; return; }
    this.error = '';
    this.wholesaleService.getStockMovements(this.movFrom, this.movTo, this.movSearch.trim(), this.onlyMoved)
      .subscribe({ next: r => this.movements = r, error: e => this.fail(e) });
  }

  // ── Product history ──────────────────────────────────────

  openHistory(productId: number): void {
    this.historyProductId = productId;
    if (this.tab === 'movement') { this.historyFrom = this.movFrom; this.historyTo = this.movTo; }
    this.loadHistory();
  }

  loadHistory(): void {
    if (!this.historyProductId) return;
    this.wholesaleService.getProductStockHistory(this.historyProductId, this.historyFrom || undefined, this.historyTo || undefined)
      .subscribe({ next: h => this.history = h, error: e => this.fail(e) });
  }

  closeHistory(): void {
    this.history = null;
    this.historyProductId = null;
  }

  // ── Adjustments ──────────────────────────────────────────

  loadAdjustments(): void {
    this.wholesaleService.getStockAdjustments().subscribe({ next: r => this.adjustments = r, error: e => this.fail(e) });
  }

  openAdjustmentForm(): void {
    this.showAdjustmentForm = true;
    this.adjDate = todayIso();
    this.adjReason = '';
    this.adjLines = [{ productId: null, quantityChange: null, notes: '' }];
    this.message = '';
  }

  productQty(id: number | null): string {
    const p = this.products.find(x => x.wholesaleProductId === id);
    return p ? `${p.availableQuantity} ${p.unit} in stock` : '';
  }

  saveAdjustment(): void {
    if (this.saving) return;
    const lines = this.adjLines.filter(l => l.productId || l.quantityChange);
    if (!this.adjReason.trim()) { this.error = 'Enter the reason for this adjustment.'; return; }
    if (!lines.length) { this.error = 'Add at least one product.'; return; }
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].productId) { this.error = `Line ${i + 1}: select a product.`; return; }
      if (!lines[i].quantityChange || Number(lines[i].quantityChange) === 0) { this.error = `Line ${i + 1}: enter a quantity change (+ to add, − to remove).`; return; }
    }
    if (this.adjDate > this.today) { this.error = 'Adjustment date cannot be in the future.'; return; }
    if (!confirm('Post this stock adjustment? It is recorded in the stock ledger and cannot be edited (post another adjustment to correct it).')) return;
    this.saving = true;
    this.error = '';
    this.wholesaleService.createStockAdjustment({
      adjustmentDate: this.adjDate, reason: this.adjReason.trim(),
      items: lines.map(l => ({ wholesaleProductId: l.productId!, quantityChange: Number(l.quantityChange), notes: l.notes.trim() || null }))
    }).subscribe({
      next: a => {
        this.saving = false;
        this.showAdjustmentForm = false;
        this.message = `Stock adjustment ${a.adjustmentNumber} posted.`;
        this.wholesaleService.getProducts().subscribe(p => this.products = p);
        this.loadAdjustments();
      },
      error: e => { this.saving = false; this.error = e.status === 403 ? 'Only an admin can post stock adjustments.' : (e.error?.message || e.message); }
    });
  }

  // ── Settings ─────────────────────────────────────────────

  toggleNegativeStock(allow: boolean): void {
    const text = allow
      ? 'Allow negative wholesale stock? Sales and adjustments will then go through even when the stock is not enough.'
      : 'Block negative wholesale stock? Movements that would take a product below zero will be refused.';
    if (!confirm(text)) { this.settings = { ...this.settings! }; return; }
    this.wholesaleService.saveInventorySettings(allow).subscribe({
      next: s => { this.settings = s; this.message = allow ? 'Negative stock is now allowed.' : 'Negative stock is now blocked.'; },
      error: e => { this.fail(e); this.wholesaleService.getInventorySettings().subscribe(s => this.settings = s); }
    });
  }
}
