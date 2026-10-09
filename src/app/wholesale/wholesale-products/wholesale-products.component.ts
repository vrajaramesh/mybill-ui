import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WholesaleService } from '../wholesale.service';
import { PurchaseService } from '../../purchase.service';
import { Supplier } from '../../supplier.model';
import { WholesaleProduct, WholesaleProductRequest } from '../wholesale.model';
import { WholesalePriceRulesComponent } from '../wholesale-price-rules/wholesale-price-rules.component';

type DetailTab = 'details' | 'pricing' | 'images';

/**
 * Wholesale Product Management. Separate from retail products: no fixed selling price
 * (quantity price rules instead) and stock that changes only through wholesale purchases.
 */
@Component({
  selector: 'app-wholesale-products',
  standalone: true,
  imports: [CommonModule, FormsModule, WholesalePriceRulesComponent],
  templateUrl: './wholesale-products.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-products.component.css']
})
export class WholesaleProductsComponent implements OnInit {
  readonly units = ['Meters', 'Pieces', 'Kg', 'Rolls', 'Bales', 'Boxes', 'Sets'];

  products: WholesaleProduct[] = [];
  suppliers: Supplier[] = [];
  loading = false;
  listError = '';

  searchTerm = '';
  statusFilter: 'ACTIVE' | 'INACTIVE' | 'ALL' = 'ACTIVE';
  stockFilter: 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK' = 'ALL';
  pricingFilter: 'ALL' | 'PRICED' | 'UNPRICED' = 'ALL';

  /** Product open in the detail panel; null with creating=true means "Add product". */
  selected: WholesaleProduct | null = null;
  creating = false;
  tab: DetailTab = 'details';
  draft: WholesaleProductRequest = { productName: '', unit: 'Meters' };
  saving = false;
  uploading = false;
  detailError = '';

  constructor(private wholesaleService: WholesaleService, private purchaseService: PurchaseService) { }

  ngOnInit(): void {
    this.load();
    this.purchaseService.getSuppliers().subscribe({ next: s => this.suppliers = s, error: () => {} });
  }

  load(): void {
    this.loading = true;
    this.wholesaleService.getProducts().subscribe({
      next: data => {
        this.products = data;
        this.loading = false;
        if (this.selected) this.selected = data.find(p => p.wholesaleProductId === this.selected!.wholesaleProductId) || null;
      },
      error: err => { this.loading = false; this.listError = 'Could not load wholesale products: ' + (err.error?.message || err.message); }
    });
  }

  get filteredProducts(): WholesaleProduct[] {
    const term = this.searchTerm.toLowerCase().trim();
    return this.products.filter(p =>
      (this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE') === p.isActive) &&
      (this.stockFilter === 'ALL' || (this.stockFilter === 'IN_STOCK') === (Number(p.availableQuantity) > 0)) &&
      (this.pricingFilter === 'ALL' || (this.pricingFilter === 'PRICED') === (p.activePriceRuleCount > 0)) &&
      (!term || [p.productName, p.productCode, p.productType, p.material, p.hsnCode]
        .some(v => (v || '').toLowerCase().includes(term))));
  }

  get summary() {
    const active = this.products.filter(p => p.isActive);
    return {
      active: active.length,
      outOfStock: active.filter(p => Number(p.availableQuantity) <= 0).length,
      unpriced: active.filter(p => p.activePriceRuleCount === 0).length
    };
  }

  open(product: WholesaleProduct, tab: DetailTab = 'details'): void {
    this.creating = false;
    this.selected = product;
    this.tab = tab;
    this.detailError = '';
    this.draft = {
      productCode: product.productCode, productName: product.productName, productType: product.productType,
      hsnCode: product.hsnCode, description: product.description, material: product.material, unit: product.unit,
      gstPct: product.gstPct, supplierId: product.supplierId, isActive: product.isActive,
      fabricType: product.fabricType, availableColors: product.availableColors, availableDesigns: product.availableDesigns, specifications: product.specifications,
    };
  }

  startCreate(): void {
    this.selected = null;
    this.creating = true;
    this.tab = 'details';
    this.detailError = '';
    this.draft = { productName: '', unit: 'Meters', gstPct: 5, isActive: true };
  }

  close(): void {
    this.selected = null;
    this.creating = false;
  }

  private validateDraft(): string {
    if (!this.draft.productName?.trim()) return 'Product name is required.';
    if (!this.draft.unit) return 'Unit is required.';
    if (this.draft.hsnCode && !/^\d{4}(\d{2})?(\d{2})?$/.test(this.draft.hsnCode.trim())) return 'HSN code must be 4, 6 or 8 digits.';
    const gst = Number(this.draft.gstPct);
    if (this.draft.gstPct !== null && this.draft.gstPct !== undefined && (isNaN(gst) || gst < 0 || gst > 100))
      return 'GST % must be between 0 and 100.';
    return '';
  }

  saveDetails(): void {
    this.detailError = this.validateDraft();
    if (this.detailError || this.saving) return;
    this.saving = true;
    const call = this.creating
      ? this.wholesaleService.createProduct(this.draft)
      : this.wholesaleService.updateProduct(this.selected!.wholesaleProductId, this.draft);
    call.subscribe({
      next: product => {
        this.saving = false;
        const wasCreating = this.creating;
        this.load();
        this.open(product, wasCreating ? 'pricing' : 'details');
      },
      error: err => { this.saving = false; this.detailError = err.error?.message || err.message; }
    });
  }

  toggleStatus(product: WholesaleProduct, event?: Event): void {
    event?.stopPropagation();
    const request: WholesaleProductRequest = {
      productCode: product.productCode, productName: product.productName, productType: product.productType,
      hsnCode: product.hsnCode, description: product.description, material: product.material, unit: product.unit,
      gstPct: product.gstPct, isActive: !product.isActive,
      fabricType: product.fabricType, availableColors: product.availableColors, availableDesigns: product.availableDesigns, specifications: product.specifications,
    };
    this.wholesaleService.updateProduct(product.wholesaleProductId, request).subscribe({
      next: updated => {
        this.load();
        if (this.selected?.wholesaleProductId === updated.wholesaleProductId) this.open(updated, this.tab);
      },
      error: err => alert(err.error?.message || err.message)
    });
  }

  deleteProduct(): void {
    if (!this.selected || !confirm(`Delete wholesale product '${this.selected.productName}'? This cannot be undone.`)) return;
    this.wholesaleService.deleteProduct(this.selected.wholesaleProductId).subscribe({
      next: () => { this.close(); this.load(); },
      error: err => this.detailError = err.error?.message || err.message
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.selected) return;
    const productId = this.selected.wholesaleProductId;
    this.uploading = true;
    this.wholesaleService.uploadImage(file).subscribe({
      next: res => this.wholesaleService.addProductImage(productId, res.secure_url, res.public_id).subscribe({
        next: () => { this.uploading = false; input.value = ''; this.load(); },
        error: err => { this.uploading = false; this.detailError = err.error?.message || err.message; }
      }),
      error: err => { this.uploading = false; this.detailError = 'Upload failed: ' + (err.error?.error || err.message); }
    });
  }

  removeImage(imageId: number): void {
    if (!this.selected || !confirm('Remove this image?')) return;
    this.wholesaleService.deleteProductImage(this.selected.wholesaleProductId, imageId).subscribe({
      next: () => this.load(),
      error: err => this.detailError = err.error?.message || err.message
    });
  }
}
