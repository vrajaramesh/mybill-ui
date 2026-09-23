import { Component, OnInit } from '@angular/core';
import { PurchaseService } from '../purchase.service';
import { DebitNote, DebitNoteItem, Purchase, PurchaseItem, PurchasePayment } from '../purchase.model';
import { Supplier } from '../supplier.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../product.model';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-purchase-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-list.component.html',
  styleUrl: './purchase-list.component.css'
})
export class PurchaseListComponent implements OnInit {
  purchases: Purchase[] = [];
  suppliers: Supplier[] = [];
  products: Product[] = [];
  categories: any[] = [];
  selectedPurchase: Purchase | null = null;
  searchTerm: string = '';
  selectedSupplier: string = '';
  selectedStatus: string = '';
  showSupplierModal: boolean = false;
  newSupplier: Partial<Supplier> = {};
  selectedSupplierForPurchase: Supplier | null = null;
  showProductModal: boolean = false;
  newProduct: Partial<Product> = {};
  selectedCategory: string = '';
  selectedItemIndex: number = -1;
  productSearchTerms: string[] = [];
  openDropdownIndex: number = -1;
  highlightedProductIndex: number = -1;
  debitNotePurchase: Purchase | null = null;
  debitNoteDraft: DebitNote | null = null;
  debitNoteHistoryPurchase: Purchase | null = null;
  debitNotes: DebitNote[] = [];
  returnedByItemId: Record<number, number> = {};

  constructor(private purchaseService: PurchaseService, private settings: SettingsService) { }

  ngOnInit(): void {
    this.loadPurchases();
    this.loadSuppliers();
    this.loadProducts();
    this.loadCategories();
  }

  loadPurchases(): void {
    this.purchaseService.getPurchases().subscribe(data => {
      this.purchases = data;
    });
  }

  loadSuppliers(): void {
    this.purchaseService.getSuppliers().subscribe(data => {
      this.suppliers = data;
    });
  }

  loadProducts(): void {
    this.purchaseService.getProducts().subscribe(data => {
      this.products = data;
    });
  }

  loadCategories(): void {
    this.purchaseService.getProductCategories().subscribe(data => {
      this.categories = data;
    });
  }

  get filteredPurchases(): Purchase[] {
    return this.purchases.filter(purchase => {
      const matchesSearch = !this.searchTerm ||
        purchase.invoiceNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (purchase.supplier?.supplierName && purchase.supplier.supplierName.toLowerCase().includes(this.searchTerm.toLowerCase()));

      const matchesSupplier = !this.selectedSupplier || purchase.supplier?.supplierName === this.selectedSupplier;
      const matchesStatus = !this.selectedStatus || purchase.paymentStatus === this.selectedStatus;

      return matchesSearch && matchesSupplier && matchesStatus;
    });
  }

  selectPurchase(purchase: Purchase): void {
    this.selectedPurchase = {
      ...purchase,
      purchaseItems: purchase.purchaseItems ? purchase.purchaseItems.map(item => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const gst = Number(item.gst) || 5;
        const totalPrice = parseFloat((qty * price).toFixed(2));
        const finalPrice = parseFloat((totalPrice * (1 + gst / 100)).toFixed(2));
        return {
          ...item,
          product: item.product ? this.products.find(p => p.productId === item.product?.productId) || item.product : undefined,
          gst,
          totalPrice,
          finalPrice
        };
      }) : []
    };
    this.selectedSupplierForPurchase = this.suppliers.find(
      s => s.supplierId === purchase.supplier?.supplierId
    ) || null;
    this.productSearchTerms = (this.selectedPurchase.purchaseItems || []).map(item =>
      item.product ? `${item.product.productName} (ID: ${item.product.productId})` : ''
    );
    this.calculateTotalAmount();
  }

  deletePurchase(id: number): void {
    if (confirm('Are you sure you want to delete this purchase?')) {
      this.purchaseService.deletePurchase(id).subscribe(() => {
        this.loadPurchases();
      });
    }
  }

  openDebitNote(purchase: Purchase): void {
    if (!purchase.purchaseId) return;
    this.debitNotePurchase = purchase;
    this.debitNoteDraft = {
      noteDate: new Date().toISOString().split('T')[0],
      reason: '',
      items: (purchase.purchaseItems || []).map(item => ({
        purchaseItem: item,
        product: item.product,
        quantity: 0,
        unitPrice: Number(item.unitPrice) || 0,
        gst: Number(item.gst) || 5
      }))
    };
    this.returnedByItemId = {};
    this.purchaseService.getDebitNotes(purchase.purchaseId).subscribe({
      next: notes => {
        notes.flatMap(note => note.items || []).forEach(item => {
          const id = item.purchaseItem?.purchaseItemId;
          if (id) this.returnedByItemId[id] = (this.returnedByItemId[id] || 0) + Number(item.quantity || 0);
        });
      },
      error: err => alert('Could not load previous returns: ' + (err.error?.message || err.message))
    });
  }

  closeDebitNote(): void {
    this.debitNotePurchase = null;
    this.debitNoteDraft = null;
    this.returnedByItemId = {};
  }

  viewDebitNotes(purchase: Purchase): void {
    if (!purchase.purchaseId) return;
    this.debitNoteHistoryPurchase = purchase;
    this.debitNotes = [];
    this.purchaseService.getDebitNotes(purchase.purchaseId).subscribe({
      next: notes => this.debitNotes = notes,
      error: err => alert('Could not load debit notes: ' + (err.error?.message || err.message))
    });
  }

  closeDebitNoteHistory(): void {
    this.debitNoteHistoryPurchase = null;
    this.debitNotes = [];
  }

  returnableQuantity(item: PurchaseItem): number {
    const purchased = Number(item.quantity) || 0;
    return Math.max(purchased - (this.returnedByItemId[item.purchaseItemId || -1] || 0), 0);
  }

  onDebitNoteItemChange(item: DebitNoteItem): void {
    const quantity = Number(item.quantity) || 0;
    const base = quantity * (Number(item.unitPrice) || 0);
    const gst = Number(item.gst) || 5;
    item.totalAmount = parseFloat(base.toFixed(2));
    item.finalAmount = parseFloat((base * (1 + gst / 100)).toFixed(2));
    if (this.debitNoteDraft) {
      this.debitNoteDraft.totalAmount = parseFloat(this.debitNoteDraft.items.reduce((sum, i) => sum + (i.totalAmount || 0), 0).toFixed(2));
      this.debitNoteDraft.finalAmount = parseFloat(this.debitNoteDraft.items.reduce((sum, i) => sum + (i.finalAmount || 0), 0).toFixed(2));
      this.debitNoteDraft.gst = parseFloat(((this.debitNoteDraft.finalAmount || 0) - (this.debitNoteDraft.totalAmount || 0)).toFixed(2));
    }
  }

  saveDebitNote(): void {
    if (!this.debitNotePurchase?.purchaseId || !this.debitNoteDraft) return;
    const items = this.debitNoteDraft.items.filter(item => Number(item.quantity) > 0);
    if (!items.length) { alert('Enter a return quantity for at least one item.'); return; }
    const invalid = items.find(item => Number(item.quantity) > this.returnableQuantity(item.purchaseItem!));
    if (invalid) { alert('Return quantity exceeds the remaining quantity for ' + (invalid.product?.productName || 'an item') + '.'); return; }
    this.purchaseService.createDebitNote(this.debitNotePurchase.purchaseId, { ...this.debitNoteDraft, items }).subscribe({
      next: note => {
        alert(`Debit note ${note.noteNumber} created. Stock has been reduced.`);
        this.printDebitNote(note, this.debitNotePurchase);
        this.closeDebitNote();
        this.loadPurchases();
        this.loadProducts();
      },
      error: err => alert('Error creating debit note: ' + (err.error?.message || err.message))
    });
  }

  printDebitNote(note: DebitNote, purchase: Purchase | null = this.debitNoteHistoryPurchase): void {
    const rows = (note.items || []).map((item, i) => `<tr><td>${i + 1}</td><td>${item.product?.productName || ''}</td><td>${item.quantity}</td><td>₹${Number(item.unitPrice || 0).toFixed(2)}</td><td>₹${Number(item.finalAmount || 0).toFixed(2)}</td></tr>`).join('');
    const supplier = purchase?.supplier || note.purchase?.supplier;
    const firmName = this.settings.firmName || 'SRISA FABRICS';
    const firmAddress = this.settings.address;
    const firmGst = this.settings.gstNumber;
    const firmPhone = this.settings.whatsappPhone;
    const firmLogo = this.settings.logo;
    const win = window.open('', '_blank', 'width=800,height=650');
    if (!win) return;
    win.document.write(`<html><head><title>${note.noteNumber}</title><style>body{font-family:Arial;padding:30px;color:#111}.header{text-align:center;border-bottom:2px solid #222;padding-bottom:16px}.logo{max-height:70px;max-width:180px;display:block;margin:0 auto 8px}.firm{font-size:24px;font-weight:bold}.muted{color:#555;margin:4px 0}.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}.box{border:1px solid #ccc;padding:12px;min-height:95px}.box h3{margin:0 0 8px;font-size:14px}.box p{margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th:nth-child(n+3),td:nth-child(n+3){text-align:right}.total{text-align:right;font-weight:bold;margin-top:20px;line-height:1.8}.footer{margin-top:35px;border-top:1px solid #ccc;padding-top:10px;font-size:12px;color:#555}@media print{body{padding:0}}</style></head><body><div class="header">${firmLogo ? `<img class="logo" src="${firmLogo}" alt="${firmName}">` : ''}<div class="firm">${firmName}</div>${firmAddress ? `<div class="muted">${firmAddress}</div>` : ''}${firmGst ? `<div class="muted"><b>GSTIN:</b> ${firmGst}</div>` : ''}${firmPhone ? `<div class="muted"><b>Phone:</b> ${firmPhone}</div>` : ''}</div><div class="parties"><div class="box"><h3>Debit Note To</h3><p><b>${supplier?.supplierName || 'Supplier'}</b></p>${supplier?.contactPerson ? `<p>Contact: ${supplier.contactPerson}</p>` : ''}${supplier?.address ? `<p>Address: ${supplier.address}</p>` : ''}${supplier?.phone ? `<p>Phone: ${supplier.phone}</p>` : ''}${supplier?.email ? `<p>Email: ${supplier.email}</p>` : ''}${supplier?.gstNumber ? `<p><b>GSTIN:</b> ${supplier.gstNumber}</p>` : '<p><b>GSTIN:</b> Not provided</p>'}</div><div class="box"><h3>Document Details</h3><p><b>Debit Note:</b> ${note.noteNumber}</p><p><b>Date:</b> ${note.noteDate}</p><p><b>Purchase Invoice:</b> ${purchase?.invoiceNumber || note.purchase?.invoiceNumber || ''}</p><p><b>Reason:</b> ${note.reason || 'Goods returned to supplier'}</p></div></div><table><tr><th>#</th><th>Product</th><th>Qty</th><th>Rate</th><th>Amount incl. GST</th></tr>${rows}</table><p class="total">Base: ₹${Number(note.totalAmount || 0).toFixed(2)}<br>GST: ₹${Number(note.gst || 0).toFixed(2)}<br>Debit Total: ₹${Number(note.finalAmount || 0).toFixed(2)}</p><div class="footer">Goods received back by supplier against the above debit note.</div></body></html>`);
    win.document.close(); win.focus(); win.print();
  }

  addNewPurchase(): void {
    this.selectedPurchase = {
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      totalAmount: 0,
      purchaseItems: []
    };
    this.selectedSupplierForPurchase = null;
    this.productSearchTerms = [];
    this.addPurchaseItem();
  }

  savePurchase(): void {
    if (this.selectedPurchase) {
      // Set the selected supplier
      this.selectedPurchase.supplier = this.selectedSupplierForPurchase || undefined;

      // Filter out items without products
      if (this.selectedPurchase.purchaseItems) {
        this.selectedPurchase.purchaseItems = this.selectedPurchase.purchaseItems.filter(item => item.product);
      }

      // Validate that we have items
      if (!this.selectedPurchase.purchaseItems || this.selectedPurchase.purchaseItems.length === 0) {
        alert('Please add at least one purchase item with a selected product.');
        return;
      }

      if (this.selectedPurchase.purchaseId) {
        this.purchaseService.updatePurchase(this.selectedPurchase.purchaseId, this.selectedPurchase).subscribe({
          next: () => {
            this.loadPurchases();
            this.selectedPurchase = null;
            this.selectedSupplierForPurchase = null;
          },
          error: (err) => {
            console.error('Error updating purchase:', err);
            alert('Error updating purchase: ' + (err.error?.message || err.message));
          }
        });
      } else {
        this.purchaseService.createPurchase(this.selectedPurchase).subscribe({
          next: () => {
            this.loadPurchases();
            this.selectedPurchase = null;
            this.selectedSupplierForPurchase = null;
          },
          error: (err) => {
            console.error('Error creating purchase:', err);
            alert('Error creating purchase: ' + (err.error?.message || err.message));
          }
        });
      }
    }
  }

  cancelEdit(): void {
    this.selectedPurchase = null;
    this.selectedSupplierForPurchase = null;
    this.productSearchTerms = [];
    this.openDropdownIndex = -1;
  }

  openSupplierModal(): void {
    this.showSupplierModal = true;
    this.newSupplier = {};
  }

  closeSupplierModal(): void {
    this.showSupplierModal = false;
    this.newSupplier = {};
  }

  saveSupplier(): void {
    if (this.newSupplier.supplierName && this.newSupplier.supplierName.trim()) {
      this.purchaseService.createSupplier(this.newSupplier as Supplier).subscribe({
        next: (supplier) => {
          this.suppliers.push(supplier);
          this.selectedSupplierForPurchase = supplier;
          this.closeSupplierModal();
        },
        error: (err) => {
          console.error('Error creating supplier:', err);
          alert('Error creating supplier: ' + (err.error?.message || err.message));
        }
      });
    } else {
      alert('Supplier name is required.');
    }
  }

  openProductModal(index: number): void {
    this.selectedItemIndex = index;
    this.showProductModal = true;
    this.newProduct = { unit: 'Meters' };
    this.selectedCategory = '';
  }

  closeProductModal(): void {
    this.showProductModal = false;
    this.newProduct = {};
    this.selectedCategory = '';
    this.selectedItemIndex = -1;
  }

  saveProduct(): void {
    if (this.newProduct.productName && this.newProduct.productName.trim() && this.newProduct.sellingPrice && this.selectedCategory) {
      this.newProduct.category = this.categories.find(c => c.categoryName === this.selectedCategory);
      this.purchaseService.createProduct(this.newProduct as Product).subscribe({
        next: (product) => {
          this.products.push(product);
          if (this.selectedItemIndex >= 0 && this.selectedPurchase && this.selectedPurchase.purchaseItems) {
            this.selectedPurchase.purchaseItems[this.selectedItemIndex].product = product;
            this.productSearchTerms[this.selectedItemIndex] = `${product.productName} (ID: ${product.productId})`;
          }
          this.closeProductModal();
        },
        error: (err) => {
          console.error('Error creating product:', err);
          alert('Error creating product: ' + (err.error?.message || err.message));
        }
      });
    } else {
      alert('Product name, selling price, and category are required.');
    }
  }

  addPurchaseItem(): void {
    if (!this.selectedPurchase) return;
    if (!this.selectedPurchase.purchaseItems) this.selectedPurchase.purchaseItems = [];

    const newIndex = this.selectedPurchase.purchaseItems.length;
    this.selectedPurchase.purchaseItems.push({
      product: undefined,
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      gst: 5,
      finalPrice: 0
    });
    this.productSearchTerms.push('');
    setTimeout(() => {
      const el = document.getElementById(`pSearch_${newIndex}`) as HTMLInputElement;
      if (el) el.focus();
    }, 50);
  }

  removePurchaseItem(index: number): void {
    if (this.selectedPurchase && this.selectedPurchase.purchaseItems) {
      this.selectedPurchase.purchaseItems.splice(index, 1);
      this.productSearchTerms.splice(index, 1);
      this.calculateTotalAmount();
    }
  }

  getFilteredProducts(index: number): Product[] {
    const term = (this.productSearchTerms[index] || '').toLowerCase().trim();
    if (!term) return this.products;
    return this.products.filter(p =>
      p.productName.toLowerCase().includes(term) ||
      String(p.productId).includes(term)
    );
  }

  selectProduct(index: number, product: Product): void {
    if (this.selectedPurchase?.purchaseItems) {
      this.selectedPurchase.purchaseItems[index].product = product;
      this.productSearchTerms[index] = `${product.productName} (ID: ${product.productId})`;
      setTimeout(() => {
        const qtyEl = document.getElementById(`pQty_${index}`) as HTMLInputElement;
        if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
      }, 50);
    }
  }

  onProductSearchKeydown(event: KeyboardEvent, rowIndex: number): void {
    const products = this.getFilteredProducts(rowIndex);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openDropdownIndex = rowIndex;
      this.highlightedProductIndex = Math.min(this.highlightedProductIndex + 1, products.length - 1);
      this.scrollHighlightedIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedProductIndex = Math.max(this.highlightedProductIndex - 1, 0);
      this.scrollHighlightedIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightedProductIndex >= 0 && this.highlightedProductIndex < products.length) {
        this.selectProduct(rowIndex, products[this.highlightedProductIndex]);
        this.highlightedProductIndex = -1;
      }
    } else if (event.key === 'Escape') {
      this.openDropdownIndex = -1;
      this.highlightedProductIndex = -1;
    }
  }

  private scrollHighlightedIntoView(): void {
    setTimeout(() => {
      const el = document.querySelector('.dropdown-item.highlighted') as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  onProductSearchInput(index: number): void {
    this.highlightedProductIndex = -1;
    const item = this.selectedPurchase?.purchaseItems?.[index];
    if (item?.product) {
      const expected = `${item.product.productName} (ID: ${item.product.productId})`;
      if (expected !== this.productSearchTerms[index]) {
        item.product = undefined;
      }
    }
  }

  onProductSearchBlur(): void {
    setTimeout(() => {
      this.openDropdownIndex = -1;
      this.highlightedProductIndex = -1;
    }, 200);
  }

  onPurchaseItemChange(index: number): void {
    if (this.selectedPurchase && this.selectedPurchase.purchaseItems) {
      const item = this.selectedPurchase.purchaseItems[index];
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const gst = Number(item.gst) || 5;
      item.totalPrice = parseFloat((qty * price).toFixed(2));
      item.finalPrice = parseFloat((item.totalPrice * (1 + gst / 100)).toFixed(2));
      this.calculateTotalAmount();
    }
  }

  calculateTotalAmount(): void {
    if (this.selectedPurchase && this.selectedPurchase.purchaseItems) {
      const items = this.selectedPurchase.purchaseItems;
      const baseTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      const gstTotal = items.reduce((sum, item) =>
        sum + ((item.totalPrice || 0) * (Number(item.gst) || 5) / 100), 0);
      this.selectedPurchase.totalAmount = parseFloat(baseTotal.toFixed(2));
      this.selectedPurchase.gst = parseFloat(gstTotal.toFixed(2));
      this.selectedPurchase.finalAmount = parseFloat((baseTotal + gstTotal).toFixed(2));
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'PAID': return 'green';
      case 'PARTIAL': return 'orange';
      case 'PENDING': return 'red';
      default: return 'gray';
    }
  }
}
