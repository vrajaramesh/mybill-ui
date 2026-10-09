import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supplier } from '../../supplier.model';
import { WholesaleService } from '../wholesale.service';
import {
  WholesaleLineTax, WholesaleProduct, WholesaleProductRequest, WholesalePurchase,
  WholesalePurchaseRequest, computeWholesaleLineTax
} from '../wholesale.model';

interface WholesaleLine {
  mode: 'EXISTING' | 'NEW';
  product?: WholesaleProduct;
  search: string;
  newProduct: WholesaleProductRequest;
  quantity: number | null;
  purchaseRate: number | null;
  gstPct: number | null;
}

const HSN_PATTERN = /^\d{4}(\d{2})?(\d{2})?$/;

/**
 * Wholesale purchase entry. Products come from (and new products go to) the wholesale product
 * master only — never the retail product list.
 */
@Component({
  selector: 'app-wholesale-purchase-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wholesale-purchase-form.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-purchase-form.component.css']
})
export class WholesalePurchaseFormComponent implements OnInit {
  @Input() suppliers: Supplier[] = [];
  @Input() supplier: Supplier | null = null;
  @Output() supplierChange = new EventEmitter<Supplier | null>();
  @Output() addSupplier = new EventEmitter<void>();
  @Output() saved = new EventEmitter<WholesalePurchase>();
  @Output() cancelled = new EventEmitter<void>();

  readonly units = ['Meters', 'Pieces', 'Kg', 'Rolls', 'Bales', 'Boxes', 'Sets'];

  products: WholesaleProduct[] = [];
  productTypes: string[] = [];
  invoiceNumber = '';
  invoiceDate = new Date().toISOString().split('T')[0];
  interstate = false;
  paidAmount: number | null = null;
  paymentDueDate = '';
  notes = '';
  lines: WholesaleLine[] = [];
  openDropdownIndex = -1;
  saving = false;
  errorMessage = '';

  constructor(private wholesaleService: WholesaleService) { }

  ngOnInit(): void {
    this.loadProducts();
    this.addLine();
  }

  loadProducts(): void {
    this.wholesaleService.getProducts(true).subscribe({
      next: data => {
        this.products = data;
        this.productTypes = [...new Set(data.map(p => p.productType).filter((t): t is string => !!t))].sort();
      },
      error: err => this.errorMessage = 'Could not load wholesale products: ' + (err.error?.message || err.message)
    });
  }

  sameSupplier(a: Supplier | null, b: Supplier | null): boolean {
    return a === b || (!!a && !!b && a.supplierId === b.supplierId);
  }

  onSupplierChange(supplier: Supplier | null): void {
    this.supplier = supplier;
    this.supplierChange.emit(supplier);
  }

  addLine(mode: 'EXISTING' | 'NEW' = 'EXISTING'): void {
    this.lines.push({
      mode,
      search: '',
      newProduct: { productName: '', unit: 'Meters' },
      quantity: 1,
      purchaseRate: null,
      gstPct: 5
    });
  }

  removeLine(index: number): void {
    this.lines.splice(index, 1);
  }

  setMode(line: WholesaleLine, mode: 'EXISTING' | 'NEW'): void {
    line.mode = mode;
    if (mode === 'NEW') {
      line.product = undefined;
      line.search = '';
    }
  }

  filteredProducts(line: WholesaleLine): WholesaleProduct[] {
    const term = line.search.toLowerCase().trim();
    if (!term) return this.products;
    return this.products.filter(p =>
      p.productName.toLowerCase().includes(term) ||
      (p.productCode || '').toLowerCase().includes(term) ||
      (p.hsnCode || '').includes(term));
  }

  productLabel(p: WholesaleProduct): string {
    return p.productCode ? `${p.productName} [${p.productCode}]` : p.productName;
  }

  selectProduct(line: WholesaleLine, product: WholesaleProduct): void {
    line.product = product;
    line.search = this.productLabel(product);
    if (!line.purchaseRate) line.purchaseRate = Number(product.purchaseRate) || null;
    line.gstPct = Number(product.gstPct);
    this.openDropdownIndex = -1;
  }

  onSearchInput(line: WholesaleLine): void {
    if (line.product && line.search !== this.productLabel(line.product)) line.product = undefined;
  }

  onSearchBlur(): void {
    setTimeout(() => this.openDropdownIndex = -1, 200);
  }

  lineTax(line: WholesaleLine): WholesaleLineTax {
    return computeWholesaleLineTax(line.quantity || 0, line.purchaseRate || 0, line.gstPct || 0, this.interstate);
  }

  get totals(): WholesaleLineTax {
    return this.lines.map(l => this.lineTax(l)).reduce((acc, t) => ({
      taxable: acc.taxable + t.taxable, cgst: acc.cgst + t.cgst, sgst: acc.sgst + t.sgst,
      igst: acc.igst + t.igst, gst: acc.gst + t.gst, total: acc.total + t.total
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, total: 0 });
  }

  /** Returns the first problem found, or '' when the form is ready to submit. */
  validate(): string {
    if (!this.supplier?.supplierId) return 'Select a supplier.';
    if (!this.invoiceNumber.trim()) return 'Enter the supplier invoice number.';
    if (!this.invoiceDate) return 'Enter the invoice date.';
    if (this.lines.length === 0) return 'Add at least one item.';
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const n = i + 1;
      if (line.mode === 'EXISTING' && !line.product) return `Item ${n}: select a wholesale product, or switch to "New product".`;
      if (line.mode === 'NEW') {
        if (!line.newProduct.productName?.trim()) return `Item ${n}: enter the new product name.`;
        if (!line.newProduct.unit) return `Item ${n}: select a unit.`;
        const hsn = (line.newProduct.hsnCode || '').trim();
        if (hsn && !HSN_PATTERN.test(hsn)) return `Item ${n}: HSN code must be 4, 6 or 8 digits.`;
      }
      if (!(Number(line.quantity) > 0)) return `Item ${n}: quantity must be greater than 0.`;
      if (line.purchaseRate === null || line.purchaseRate === undefined || Number(line.purchaseRate) < 0)
        return `Item ${n}: enter a purchase rate (0 or more).`;
      const gst = Number(line.gstPct);
      if (line.gstPct === null || isNaN(gst) || gst < 0 || gst > 100) return `Item ${n}: GST % must be between 0 and 100.`;
    }
    if (this.paidAmount && Number(this.paidAmount) > Math.round(this.totals.total * 100) / 100)
      return 'Paid amount cannot exceed the invoice total.';
    return '';
  }

  buildRequest(): WholesalePurchaseRequest {
    const trimOrUndefined = (s?: string) => (s && s.trim()) ? s.trim() : undefined;
    return {
      supplierId: this.supplier!.supplierId!,
      invoiceNumber: this.invoiceNumber.trim(),
      invoiceDate: this.invoiceDate,
      interstate: this.interstate,
      paidAmount: this.paidAmount ? Number(this.paidAmount) : 0,
      paymentDueDate: this.paymentDueDate || undefined,
      notes: trimOrUndefined(this.notes),
      items: this.lines.map(line => ({
        wholesaleProductId: line.mode === 'EXISTING' ? line.product!.wholesaleProductId : undefined,
        newProduct: line.mode === 'NEW' ? {
          productName: line.newProduct.productName.trim(),
          productCode: trimOrUndefined(line.newProduct.productCode),
          productType: trimOrUndefined(line.newProduct.productType),
          hsnCode: trimOrUndefined(line.newProduct.hsnCode),
          description: trimOrUndefined(line.newProduct.description),
          material: trimOrUndefined(line.newProduct.material),
          unit: line.newProduct.unit
        } : undefined,
        quantity: Number(line.quantity),
        purchaseRate: Number(line.purchaseRate),
        gstPct: Number(line.gstPct)
      }))
    };
  }

  save(): void {
    this.errorMessage = this.validate();
    if (this.errorMessage || this.saving) return;
    this.saving = true;
    this.wholesaleService.createPurchase(this.buildRequest()).subscribe({
      next: purchase => {
        this.saving = false;
        this.saved.emit(purchase);
      },
      error: err => {
        this.saving = false;
        this.errorMessage = err.error?.message || err.message || 'Could not save the wholesale purchase.';
      }
    });
  }
}
