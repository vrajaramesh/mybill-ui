import { Component, OnInit } from '@angular/core';
import { PurchaseService } from '../purchase.service';
import { Purchase, PurchaseItem, PurchasePayment } from '../purchase.model';
import { Supplier } from '../supplier.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../product.model';

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

  constructor(private purchaseService: PurchaseService) { }

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
    this.selectedSupplierForPurchase = purchase.supplier || null;
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
