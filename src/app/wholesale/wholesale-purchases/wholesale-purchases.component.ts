import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../purchase.service';
import { Supplier } from '../../supplier.model';
import { WholesalePurchase } from '../wholesale.model';
import { WholesalePurchaseFormComponent } from '../wholesale-purchase-form/wholesale-purchase-form.component';
import { WholesalePurchaseListComponent } from '../wholesale-purchase-list/wholesale-purchase-list.component';

/** Wholesale → Purchases: wholesale purchase list + new wholesale purchase (stock goes to wholesale products only). */
@Component({
  selector: 'app-wholesale-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule, WholesalePurchaseFormComponent, WholesalePurchaseListComponent],
  templateUrl: './wholesale-purchases.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-purchases.component.css']
})
export class WholesalePurchasesComponent implements OnInit {
  @ViewChild(WholesalePurchaseListComponent) list?: WholesalePurchaseListComponent;

  suppliers: Supplier[] = [];
  supplier: Supplier | null = null;
  showForm = false;
  message = '';

  showSupplierModal = false;
  newSupplier: Partial<Supplier> = {};
  supplierError = '';

  constructor(private purchaseService: PurchaseService) {}

  ngOnInit(): void {
    this.purchaseService.getSuppliers().subscribe(data => this.suppliers = data);
  }

  startNew(): void {
    this.supplier = null;
    this.message = '';
    this.showForm = true;
  }

  onSaved(purchase: WholesalePurchase): void {
    this.showForm = false;
    this.supplier = null;
    this.message = `Wholesale purchase ${purchase.invoiceNumber} saved. Items were added to wholesale stock.`;
    setTimeout(() => this.list?.load());
  }

  onCancelled(): void {
    this.showForm = false;
    this.supplier = null;
  }

  openSupplierModal(): void {
    this.newSupplier = {};
    this.supplierError = '';
    this.showSupplierModal = true;
  }

  saveSupplier(): void {
    if (!this.newSupplier.supplierName?.trim()) {
      this.supplierError = 'Supplier name is required.';
      return;
    }
    this.purchaseService.createSupplier(this.newSupplier as Supplier).subscribe({
      next: s => {
        this.suppliers.push(s);
        this.supplier = s;
        this.showSupplierModal = false;
      },
      error: err => this.supplierError = err.error?.message || err.message
    });
  }
}
