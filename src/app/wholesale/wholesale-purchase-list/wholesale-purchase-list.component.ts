import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WholesaleService } from '../wholesale.service';
import { WholesalePurchase } from '../wholesale.model';

@Component({
  selector: 'app-wholesale-purchase-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wholesale-purchase-list.component.html',
  styleUrls: ['../wholesale-shared.css']
})
export class WholesalePurchaseListComponent implements OnInit {
  purchases: WholesalePurchase[] = [];
  searchTerm = '';
  selectedStatus = '';
  expandedId: number | null = null;
  loading = false;
  errorMessage = '';

  constructor(private wholesaleService: WholesaleService) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.wholesaleService.getPurchases().subscribe({
      next: data => { this.purchases = data; this.loading = false; },
      error: err => { this.loading = false; this.errorMessage = 'Could not load wholesale purchases: ' + (err.error?.message || err.message); }
    });
  }

  get filteredPurchases(): WholesalePurchase[] {
    const term = this.searchTerm.toLowerCase().trim();
    return this.purchases.filter(p =>
      (!term || p.invoiceNumber.toLowerCase().includes(term) || p.supplierName.toLowerCase().includes(term)) &&
      (!this.selectedStatus || p.paymentStatus === this.selectedStatus));
  }

  toggle(purchase: WholesalePurchase): void {
    this.expandedId = this.expandedId === purchase.wholesalePurchaseId ? null : purchase.wholesalePurchaseId;
  }

  /** Cancels (never deletes) a purchase: its quantities leave wholesale stock through the stock ledger. */
  cancelPurchase(purchase: WholesalePurchase, event: Event): void {
    event.stopPropagation();
    const reason = prompt(`Cancel wholesale purchase ${purchase.invoiceNumber}?\nIts quantities will be taken out of wholesale stock (recorded in the stock ledger). The purchase stays on record as cancelled.\n\nReason (required):`, '');
    if (reason === null) return;
    if (!reason.trim()) { alert('A reason is required.'); return; }
    this.wholesaleService.cancelPurchase(purchase.wholesalePurchaseId, reason.trim()).subscribe({
      next: () => this.load(),
      error: err => alert('Could not cancel: ' + (err.error?.message || err.message))
    });
  }
}
