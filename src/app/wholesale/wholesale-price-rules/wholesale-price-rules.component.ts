import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WholesaleService } from '../wholesale.service';
import { WholesalePriceQuote, WholesalePriceRule, WholesalePriceRuleRequest, WholesaleProduct } from '../wholesale.model';

interface RuleDraft {
  priceRuleId?: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  price: number | null;
  gstPct: number | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
}

/**
 * Quantity-based price slabs for one wholesale product (no fixed selling price, no hard-coded ranges),
 * plus a "check price" box that calls the same lookup API future quotations/sales will use.
 */
@Component({
  selector: 'app-wholesale-price-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wholesale-price-rules.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-price-rules.component.css']
})
export class WholesalePriceRulesComponent implements OnChanges {
  @Input({ required: true }) product!: WholesaleProduct;
  /** Emitted after any rule change so the parent can refresh the product's "priced" status. */
  @Output() rulesChanged = new EventEmitter<void>();

  rules: WholesalePriceRule[] = [];
  draft: RuleDraft | null = null;
  errorMessage = '';
  saving = false;

  checkQuantity: number | null = null;
  checkInterstate = false;
  checkDate = '';
  quote: WholesalePriceQuote | null = null;
  quoteError = '';

  constructor(private wholesaleService: WholesaleService) { }

  ngOnChanges(): void {
    this.draft = null;
    this.quote = null;
    this.quoteError = '';
    this.load();
  }

  load(): void {
    this.wholesaleService.getPriceRules(this.product.wholesaleProductId).subscribe({
      next: rules => this.rules = rules,
      error: err => this.errorMessage = 'Could not load price rules: ' + (err.error?.message || err.message)
    });
  }

  /** Gaps between consecutive always-effective active slabs, e.g. "9 – 10". Purely advisory. */
  get coverageHints(): string[] {
    const slabs = this.rules
      .filter(r => r.isActive && !r.effectiveFrom && !r.effectiveTo)
      .sort((a, b) => Number(a.minQuantity) - Number(b.minQuantity));
    if (slabs.length === 0) return [];
    const hints: string[] = [];
    for (let i = 1; i < slabs.length; i++) {
      const prevMax = slabs[i - 1].maxQuantity;
      if (prevMax !== null && prevMax !== undefined && Number(slabs[i].minQuantity) > Number(prevMax)) {
        hints.push(`Quantities above ${prevMax} and below ${slabs[i].minQuantity} ${this.product.unit} have no price ` +
          `(e.g. ${this.example(Number(prevMax), Number(slabs[i].minQuantity))}). Use a maximum like ` +
          `${(Number(slabs[i].minQuantity) - 0.001).toFixed(3)} if fractional quantities are sold.`);
      }
    }
    const last = slabs[slabs.length - 1];
    if (last.maxQuantity !== null && last.maxQuantity !== undefined) {
      hints.push(`No price above ${last.maxQuantity} ${this.product.unit}. Leave the maximum empty on the top slab for "and above".`);
    }
    return hints;
  }

  private example(lo: number, hi: number): string {
    return `${+(lo + (hi - lo) / 2).toFixed(3)} ${this.product.unit}`;
  }

  rangeLabel(r: { minQuantity: number; maxQuantity?: number | null }): string {
    return r.maxQuantity === null || r.maxQuantity === undefined
      ? `${r.minQuantity}+ ${this.product.unit}`
      : `${r.minQuantity} – ${r.maxQuantity} ${this.product.unit}`;
  }

  datesLabel(r: WholesalePriceRule): string {
    if (!r.effectiveFrom && !r.effectiveTo) return 'Always';
    return `${r.effectiveFrom || '…'} → ${r.effectiveTo || '…'}`;
  }

  startAdd(): void {
    const top = [...this.rules].filter(r => r.isActive)
      .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity))[0];
    const suggestedMin = top && top.maxQuantity !== null && top.maxQuantity !== undefined ? Number(top.maxQuantity) + 1 : (top ? null : 1);
    this.errorMessage = '';
    this.draft = {
      minQuantity: suggestedMin, maxQuantity: null, price: null, gstPct: null,
      isActive: true, effectiveFrom: '', effectiveTo: '', notes: ''
    };
  }

  startEdit(rule: WholesalePriceRule): void {
    this.errorMessage = '';
    this.draft = {
      priceRuleId: rule.priceRuleId,
      minQuantity: Number(rule.minQuantity),
      maxQuantity: rule.maxQuantity !== null && rule.maxQuantity !== undefined ? Number(rule.maxQuantity) : null,
      price: Number(rule.price),
      gstPct: rule.gstPct !== null && rule.gstPct !== undefined ? Number(rule.gstPct) : null,
      isActive: rule.isActive,
      effectiveFrom: rule.effectiveFrom || '',
      effectiveTo: rule.effectiveTo || '',
      notes: rule.notes || ''
    };
  }

  cancelDraft(): void {
    this.draft = null;
    this.errorMessage = '';
  }

  private isBlank(v: number | null | undefined | string): boolean {
    return v === null || v === undefined || v === '';
  }

  validate(d: RuleDraft): string {
    if (this.isBlank(d.minQuantity) || !(Number(d.minQuantity) > 0)) return 'Minimum quantity must be greater than 0.';
    if (!this.isBlank(d.maxQuantity) && Number(d.maxQuantity) < Number(d.minQuantity))
      return 'Maximum quantity must be greater than or equal to the minimum (leave it empty for "and above").';
    if (this.isBlank(d.price) || Number(d.price) < 0) return 'Enter a price per unit (0 or more).';
    if (!this.isBlank(d.gstPct) && (Number(d.gstPct) < 0 || Number(d.gstPct) > 100)) return 'GST % must be between 0 and 100.';
    if (d.effectiveFrom && d.effectiveTo && d.effectiveTo < d.effectiveFrom) return 'Effective-to date cannot be before effective-from.';
    return '';
  }

  private toRequest(d: RuleDraft): WholesalePriceRuleRequest {
    return {
      minQuantity: Number(d.minQuantity),
      maxQuantity: this.isBlank(d.maxQuantity) ? null : Number(d.maxQuantity),
      price: Number(d.price),
      gstPct: this.isBlank(d.gstPct) ? null : Number(d.gstPct),
      isActive: d.isActive,
      effectiveFrom: d.effectiveFrom || null,
      effectiveTo: d.effectiveTo || null,
      notes: d.notes.trim() || null
    };
  }

  saveDraft(): void {
    if (!this.draft || this.saving) return;
    this.errorMessage = this.validate(this.draft);
    if (this.errorMessage) return;
    const id = this.product.wholesaleProductId;
    const request = this.toRequest(this.draft);
    const call = this.draft.priceRuleId
      ? this.wholesaleService.updatePriceRule(id, this.draft.priceRuleId, request)
      : this.wholesaleService.createPriceRule(id, request);
    this.saving = true;
    call.subscribe({
      next: () => { this.saving = false; this.draft = null; this.afterChange(); },
      error: err => { this.saving = false; this.errorMessage = err.error?.message || err.message; }
    });
  }

  toggleActive(rule: WholesalePriceRule): void {
    const request: WholesalePriceRuleRequest = {
      minQuantity: rule.minQuantity, maxQuantity: rule.maxQuantity ?? null, price: rule.price,
      gstPct: rule.gstPct ?? null, isActive: !rule.isActive, effectiveFrom: rule.effectiveFrom ?? null,
      effectiveTo: rule.effectiveTo ?? null, notes: rule.notes ?? null
    };
    this.wholesaleService.updatePriceRule(this.product.wholesaleProductId, rule.priceRuleId, request).subscribe({
      next: () => this.afterChange(),
      error: err => this.errorMessage = err.error?.message || err.message
    });
  }

  deleteRule(rule: WholesalePriceRule): void {
    if (!confirm(`Delete the price rule for ${this.rangeLabel(rule)}?`)) return;
    this.wholesaleService.deletePriceRule(this.product.wholesaleProductId, rule.priceRuleId).subscribe({
      next: () => this.afterChange(),
      error: err => this.errorMessage = err.error?.message || err.message
    });
  }

  checkPrice(): void {
    this.quote = null;
    this.quoteError = '';
    if (!(Number(this.checkQuantity) > 0)) { this.quoteError = 'Enter a quantity greater than 0.'; return; }
    this.wholesaleService.getPrice(this.product.wholesaleProductId, Number(this.checkQuantity),
      this.checkInterstate, this.checkDate || undefined).subscribe({
      next: q => this.quote = q,
      error: err => this.quoteError = err.error?.message || err.message
    });
  }

  private afterChange(): void {
    this.load();
    this.rulesChanged.emit();
    if (this.quote) this.checkPrice();
  }
}
