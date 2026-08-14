import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillService } from '../bill.service';
import { ThermalPrinterService } from '../thermal-printer.service';
import { SettingsService } from '../settings.service';
import { UserService, SalesPerson } from '../user.service';
import { AuthService } from '../auth.service';
import { Bill, BillItem } from '../bill.model';
import { Customer } from '../customer.model';
import { Product } from '../product.model';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.css'
})
export class BillingComponent implements OnInit, OnChanges {
  @Input() view: 'list' | 'form' = 'list';
  @Output() viewChange = new EventEmitter<'list' | 'form'>();

  bills: Bill[] = [];
  customers: Customer[] = [];
  products: Product[] = [];
  categories: any[] = [];

  currentBill: Bill | null = null;
  searchTerm: string = '';

  // Date filter
  dateFilter: string = 'today';
  fromDate: string = '';
  toDate: string = '';
  selectedDate: string = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  prevDay(): void {
    const d = this.parseDateLocal(this.selectedDate);
    d.setDate(d.getDate() - 1);
    this.selectedDate = this.formatDateLocal(d);
    this.dateFilter = 'today';
  }

  nextDay(): void {
    const d = this.parseDateLocal(this.selectedDate);
    d.setDate(d.getDate() + 1);
    this.selectedDate = this.formatDateLocal(d);
    this.dateFilter = 'today';
  }

  goToday(): void {
    this.selectedDate = this.formatDateLocal(new Date());
    this.dateFilter = 'today';
  }

  private parseDateLocal(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private formatDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Settings
  showSettingsModal: boolean = false;
  businessPhone: string = localStorage.getItem('mybill_business_phone') || '8008152007';

  // Customer search
  customerSearchTerm: string = '';
  showCustomerDropdown: boolean = false;

  // Product search per item row
  productSearchTerms: string[] = [];
  openDropdownIndex: number = -1;
  highlightedProductIndex: number = -1;

  // Add Customer modal
  showCustomerModal: boolean = false;
  newCustomer: Partial<Customer> = {};

  // Add Product modal
  showProductModal: boolean = false;
  newProduct: Partial<Product> = {};
  selectedCategory: string = '';
  selectedItemIndex: number = -1;

  // Sales person selection
  salesPersons: SalesPerson[] = [];
  selectedSalesPersonId: number | null = null;
  selectedSalesPersonName: string = '';

  constructor(
    private billService: BillService,
    private printer: ThermalPrinterService,
    private settings: SettingsService,
    private userService: UserService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadBills();
    this.loadCustomers();
    this.loadProducts();
    this.loadCategories();
    this.loadSalesPersons();
  }

  loadSalesPersons(): void {
    this.userService.getSalesPersons().subscribe({
      next: persons => {
        this.salesPersons = persons;
        const me = this.authService.getCurrentUser();
        if (me) {
          const match = persons.find(p => p.userId === me.userId || p.username === me.username);
          if (match) {
            this.selectedSalesPersonId = match.userId;
            this.selectedSalesPersonName = match.fullName || match.username;
          } else {
            // Logged-in user not in SALES list (e.g. ADMIN) — default to first person
            this.selectedSalesPersonId = persons[0]?.userId ?? null;
            this.selectedSalesPersonName = persons[0]?.fullName ?? '';
          }
        }
      },
      error: () => { /* non-critical — billing still works without sales person */ }
    });
  }

  onSalesPersonChange(userId: string): void {
    const id = parseInt(userId, 10);
    const person = this.salesPersons.find(p => p.userId === id);
    this.selectedSalesPersonId = person?.userId ?? null;
    this.selectedSalesPersonName = person?.fullName || person?.username || '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['view']) {
      const newView = changes['view'].currentValue as 'list' | 'form';
      if (newView === 'form' && this.currentBill === null) {
        this.addNewBill();
      }
    }
  }

  loadBills(): void {
    this.billService.getBills().subscribe(data => { this.bills = data; });
  }

  loadCustomers(): void {
    this.billService.getCustomers().subscribe(data => { this.customers = data; });
  }

  loadProducts(): void {
    this.billService.getProducts().subscribe(data => { this.products = data; });
  }

  loadCategories(): void {
    this.billService.getProductCategories().subscribe(data => { this.categories = data; });
  }

  get isSales(): boolean { return this.authService.isSales(); }

  get filteredBills(): Bill[] {
    let bills = this.applyDateFilter(this.bills);

    if (this.isSales && this.selectedSalesPersonId !== null) {
      bills = bills.filter(b => b.salesPersonId === this.selectedSalesPersonId);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      bills = bills.filter(b =>
        b.billNumber?.toLowerCase().includes(term) ||
        b.customer?.customerName?.toLowerCase().includes(term) ||
        b.customer?.phone?.includes(term)
      );
    }
    return bills;
  }

  private applyDateFilter(bills: Bill[]): Bill[] {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const toDate = (s: string | undefined): Date => {
      const [y, m, day] = (s || '').split('-').map(Number);
      return new Date(y, m - 1, day);
    };

    switch (this.dateFilter) {
      case 'today': {
        const sel = new Date(this.selectedDate + 'T00:00:00'); sel.setHours(0, 0, 0, 0);
        return bills.filter(b => toDate(b.billDate).getTime() === sel.getTime());
      }

      case 'yesterday': {
        const yest = new Date(today); yest.setDate(today.getDate() - 1);
        return bills.filter(b => toDate(b.billDate).getTime() === yest.getTime());
      }
      case 'this_week': {
        const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
        return bills.filter(b => toDate(b.billDate) >= weekStart);
      }
      case 'last_month': {
        const start = new Date(today); start.setMonth(today.getMonth() - 1);
        return bills.filter(b => toDate(b.billDate) >= start);
      }
      case 'last_3_months': {
        const start = new Date(today); start.setMonth(today.getMonth() - 3);
        return bills.filter(b => toDate(b.billDate) >= start);
      }
      case 'this_year': {
        const start = new Date(today.getFullYear(), 0, 1);
        return bills.filter(b => toDate(b.billDate) >= start);
      }
      case 'last_year': {
        const start = new Date(today.getFullYear() - 1, 0, 1);
        const end   = new Date(today.getFullYear() - 1, 11, 31);
        return bills.filter(b => toDate(b.billDate) >= start && toDate(b.billDate) <= end);
      }
      case 'custom': {
        return bills.filter(b => {
          const d = toDate(b.billDate);
          const from = this.fromDate ? new Date(this.fromDate) : null;
          const to   = this.toDate   ? new Date(this.toDate)   : null;
          return (!from || d >= from) && (!to || d <= to);
        });
      }
      default: // 'all'
        return bills;
    }
  }

  get summaryCount(): number { return this.filteredBills.length; }

  get summaryTotal(): number {
    return this.filteredBills.reduce((s, b) => s + Number(b.totalAmount || 0), 0);
  }

  get summaryCash(): number {
    return this.filteredBills.filter(b => b.paymentMethod === 'CASH')
      .reduce((s, b) => s + Number(b.totalAmount || 0), 0);
  }

  get summaryUpi(): number {
    return this.filteredBills.filter(b => b.paymentMethod === 'UPI')
      .reduce((s, b) => s + Number(b.totalAmount || 0), 0);
  }

  get summaryCard(): number {
    return this.filteredBills.filter(b => b.paymentMethod === 'CARD')
      .reduce((s, b) => s + Number(b.totalAmount || 0), 0);
  }

  // ── Bill CRUD ──────────────────────────────────────────────

  addNewBill(): void {
    this.currentBill = {
      billDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
      paymentMethod: 'CASH',
      billItems: []
    };
    this.customerSearchTerm = '';
    this.productSearchTerms = [];
    this.addBillItem();
  }

  selectBill(bill: Bill): void {
    this.currentBill = {
      ...bill,
      billItems: (bill.billItems || []).map(item => ({ ...item }))
    };
    this.customerSearchTerm = bill.customer
      ? this.formatCustomer(bill.customer)
      : '';
    this.productSearchTerms = (this.currentBill.billItems || []).map(item =>
      item.product ? this.formatProduct(item.product) : ''
    );
    // Restore isMisc flag for items that have no product
    (this.currentBill.billItems || []).forEach(item => {
      if (!item.product) item.isMisc = true;
    });
    this.calculateBillTotals();
    this.viewChange.emit('form');
  }

  saveAndPrint(): void {
    this.saveBill(true);
  }

  saveBill(andPrint: boolean = false): void {
    if (!this.currentBill) return;

    // Attach selected sales person
    this.currentBill.salesPersonId = this.selectedSalesPersonId ?? undefined;
    this.currentBill.salesPersonName = this.selectedSalesPersonName || undefined;

    // Drop rows that have neither a product nor a description
    this.currentBill.billItems = (this.currentBill.billItems || [])
      .filter(i => i.product || i.itemDescription?.trim());

    if (this.currentBill.billItems.length === 0) {
      alert('Please add at least one item.');
      return;
    }

    if (this.currentBill.billId) {
      this.billService.updateBill(this.currentBill.billId, this.currentBill).subscribe({
        next: (saved) => {
          this.loadBills(); this.loadProducts(); this.cancelEdit();
          this.viewChange.emit('list');
          if (andPrint) this._doPrint(saved);
        },
        error: (err) => alert('Error updating bill: ' + (err.error?.message || err.message))
      });
    } else {
      this.billService.createBill(this.currentBill).subscribe({
        next: (saved) => {
          this.loadBills(); this.loadProducts(); this.cancelEdit();
          this.viewChange.emit('list');
          if (andPrint) this._doPrint(saved);
        },
        error: (err) => alert('Error creating bill: ' + (err.error?.message || err.message))
      });
    }
  }

  deleteBill(id: number): void {
    if (confirm('Delete this bill?')) {
      this.billService.deleteBill(id).subscribe(() => this.loadBills());
    }
  }

  cancelEdit(): void {
    this.currentBill = null;
    this.customerSearchTerm = '';
    this.productSearchTerms = [];
    this.openDropdownIndex = -1;
    this.viewChange.emit('list');
  }

  // ── Bill Items ─────────────────────────────────────────────

  addBillItem(): void {
    if (!this.currentBill) return;
    if (!this.currentBill.billItems) this.currentBill.billItems = [];
    const newIndex = this.currentBill.billItems.length;
    this.currentBill.billItems.push({
      product: undefined,
      quantity: 1,
      unitPrice: 0,
      discountPct: 0,
      gstPct: 5,
      taxableAmount: 0,
      gstAmount: 0,
      totalPrice: 0
    });
    this.productSearchTerms.push('');
    setTimeout(() => {
      const el = document.getElementById(`productSearch_${newIndex}`) as HTMLInputElement;
      if (el) el.focus();
    }, 50);
  }

  addMiscItem(): void {
    if (!this.currentBill) return;
    if (!this.currentBill.billItems) this.currentBill.billItems = [];
    const newIndex = this.currentBill.billItems.length;
    this.currentBill.billItems.push({
      product: undefined,
      itemDescription: '',
      isMisc: true,
      quantity: 1,
      unitPrice: 0,
      discountPct: 0,
      gstPct: 5,
      taxableAmount: 0,
      gstAmount: 0,
      totalPrice: 0
    });
    this.productSearchTerms.push('');
    setTimeout(() => {
      const el = document.getElementById(`miscDesc_${newIndex}`) as HTMLInputElement;
      if (el) el.focus();
    }, 50);
  }

  removeBillItem(index: number): void {
    if (this.currentBill?.billItems) {
      this.currentBill.billItems.splice(index, 1);
      this.productSearchTerms.splice(index, 1);
      this.calculateBillTotals();
    }
  }

  onBillItemChange(index: number): void {
    if (!this.currentBill?.billItems) return;
    const item = this.currentBill.billItems[index];
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discountPct) || 0;
    const gstPct = Number(item.gstPct) || 5;

    const lineTotal = parseFloat((qty * price * (1 - disc / 100)).toFixed(2));
    const taxable = parseFloat((lineTotal / (1 + gstPct / 100)).toFixed(2));
    const gstAmt = parseFloat((lineTotal - taxable).toFixed(2));

    item.totalPrice = lineTotal;
    item.taxableAmount = taxable;
    item.gstAmount = gstAmt;

    this.calculateBillTotals();
  }

  calculateBillTotals(): void {
    if (!this.currentBill) return;
    const items = this.currentBill.billItems || [];
    const subtotal = items.reduce((s, i) => s + (i.taxableAmount || 0), 0);
    const gstAmt = items.reduce((s, i) => s + (i.gstAmount || 0), 0);
    const total = items.reduce((s, i) => s + (i.totalPrice || 0), 0);
    this.currentBill.subtotal = parseFloat(subtotal.toFixed(2));
    this.currentBill.gstAmount = parseFloat(gstAmt.toFixed(2));
    this.currentBill.totalAmount = parseFloat(total.toFixed(2));
  }

  // ── Product Search ─────────────────────────────────────────

  getFilteredProducts(index: number): Product[] {
    const term = (this.productSearchTerms[index] || '').toLowerCase().trim();
    if (!term) return this.products;
    return this.products.filter(p =>
      p.productName.toLowerCase().includes(term) ||
      String(p.productId).includes(term)
    );
  }

  selectProduct(index: number, product: Product): void {
    if (!this.currentBill?.billItems) return;
    this.currentBill.billItems[index].product = product;
    this.currentBill.billItems[index].unitPrice = Number(product.sellingPrice) || 0;
    this.productSearchTerms[index] = this.formatProduct(product);
    this.onBillItemChange(index);
    setTimeout(() => {
      const qtyEl = document.getElementById(`qty_${index}`) as HTMLInputElement;
      if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
    }, 50);
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
    const item = this.currentBill?.billItems?.[index];
    if (item?.product) {
      if (this.formatProduct(item.product) !== this.productSearchTerms[index]) {
        item.product = undefined;
        item.unitPrice = 0;
        this.onBillItemChange(index);
      }
    }
  }

  onProductSearchBlur(): void {
    setTimeout(() => {
      this.openDropdownIndex = -1;
      this.highlightedProductIndex = -1;
    }, 200);
  }

  formatProduct(p: Product): string {
    return `${p.productName} (ID: ${p.productId})`;
  }

  // ── Customer Search ────────────────────────────────────────

  get filteredCustomers(): Customer[] {
    const term = this.customerSearchTerm.toLowerCase().trim();
    if (!term) return this.customers;
    return this.customers.filter(c =>
      c.customerName?.toLowerCase().includes(term) ||
      c.phone?.includes(term)
    );
  }

  selectCustomer(customer: Customer): void {
    if (this.currentBill) {
      this.currentBill.customer = customer;
      this.customerSearchTerm = this.formatCustomer(customer);
    }
    // Dropdown closes via onCustomerSearchBlur's setTimeout
  }

  onCustomerSearchInput(): void {
    this.showCustomerDropdown = true;
    if (this.currentBill?.customer) {
      if (this.formatCustomer(this.currentBill.customer) !== this.customerSearchTerm) {
        this.currentBill.customer = undefined;
      }
    }
  }

  onCustomerSearchBlur(): void {
    setTimeout(() => { this.showCustomerDropdown = false; }, 200);
  }

  clearCustomer(): void {
    if (this.currentBill) {
      this.currentBill.customer = undefined;
      this.customerSearchTerm = '';
    }
  }

  formatCustomer(c: Customer): string {
    if (c.customerName && c.phone) return `${c.customerName} (${c.phone})`;
    if (c.customerName) return c.customerName;
    if (c.phone) return c.phone;
    return '';
  }

  // ── Add Customer Modal ─────────────────────────────────────

  openCustomerModal(): void {
    this.showCustomerModal = true;
    this.newCustomer = {};
  }

  closeCustomerModal(): void {
    this.showCustomerModal = false;
    this.newCustomer = {};
  }

  saveCustomer(): void {
    if (!this.newCustomer.customerName?.trim() && !this.newCustomer.phone?.trim()) {
      alert('Please provide at least a name or phone number.');
      return;
    }
    this.billService.createCustomer(this.newCustomer as Customer).subscribe({
      next: (customer) => {
        this.customers.push(customer);
        if (this.currentBill) {
          this.currentBill.customer = customer;
          this.customerSearchTerm = this.formatCustomer(customer);
        }
        this.closeCustomerModal();
      },
      error: (err) => alert('Error saving customer: ' + (err.error?.message || err.message))
    });
  }

  // ── Add Product Modal ──────────────────────────────────────

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
    if (!this.newProduct.productName?.trim() || !this.newProduct.sellingPrice || !this.selectedCategory) {
      alert('Product name, selling price, and category are required.');
      return;
    }
    this.newProduct.category = this.categories.find(c => c.categoryName === this.selectedCategory);
    this.billService.createProduct(this.newProduct as Product).subscribe({
      next: (product) => {
        this.products.push(product);
        if (this.selectedItemIndex >= 0 && this.currentBill?.billItems) {
          this.selectProduct(this.selectedItemIndex, product);
        }
        this.closeProductModal();
      },
      error: (err) => alert('Error saving product: ' + (err.error?.message || err.message))
    });
  }

  // ── Settings ───────────────────────────────────────────────

  openSettings(): void { this.showSettingsModal = true; }
  closeSettings(): void { this.showSettingsModal = false; }

  saveSettings(): void {
    this.settings.saveWhatsappPhone(this.businessPhone);
    this.closeSettings();
  }

  // ── WhatsApp ───────────────────────────────────────────────

  canSendWhatsApp(bill: Bill | null): boolean {
    return !!bill?.customer?.phone;
  }

  sendWhatsApp(bill: Bill | null): void {
    if (!bill) return;
    if (!bill.customer?.phone) {
      alert('No customer phone number. Please select a customer with a phone number to send on WhatsApp.');
      return;
    }
    if (!bill.billItems || bill.billItems.length === 0) {
      this.billService.getBill(bill.billId!).subscribe(full => this.openWhatsApp(full));
    } else {
      this.openWhatsApp(bill);
    }
  }

  private openWhatsApp(bill: Bill): void {
    const rawPhone = (bill.customer!.phone || '').replace(/\D/g, '');
    const phone = rawPhone.startsWith('91') ? rawPhone : '91' + rawPhone;
    const text = this.buildWhatsAppText(bill);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  private buildWhatsAppText(bill: Bill): string {
    const date = bill.billDate
      ? new Date(bill.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    const items = (bill.billItems || []).map((item, i) => {
      const name = item.product?.productName || item.itemDescription || '—';
      const qty  = `${Number(item.quantity).toFixed(2)} ${item.product?.unit || ''}`.trim();
      const rate = Number(item.unitPrice).toFixed(2);
      const disc = Number(item.discountPct) > 0 ? ` (-${item.discountPct}%)` : '';
      const amt  = Number(item.totalPrice).toFixed(2);
      return `${i + 1}. ${name}${disc}\n   ${qty} × ₹${rate} = *₹${amt}*`;
    }).join('\n');

    const subtotal = Number(bill.subtotal || 0).toFixed(2);
    const gst      = Number(bill.gstAmount || 0).toFixed(2);
    const total    = Number(bill.totalAmount || 0).toFixed(2);
    const greeting = bill.customer?.customerName ? `Dear ${bill.customer.customerName},\n\n` : '';

    return `${greeting}*🧾 SRISA FABRICS*\n` +
      `Bill #: *${bill.billNumber}*\n` +
      `Date: ${date}  |  Payment: ${bill.paymentMethod}\n` +
      `──────────────────────\n` +
      `*Items:*\n${items}\n` +
      `──────────────────────\n` +
      `Taxable: ₹${subtotal}\n` +
      `GST (5%): ₹${gst}\n` +
      `*TOTAL: ₹${total}*\n` +
      `──────────────────────\n` +
      `Thank you for shopping with us! 🙏\n` +
      `VISIT : www.srisafabrics.com \n` +
      `For queries: ${this.businessPhone}`;
  }

  getPaymentBadgeColor(method: string): string {
    switch (method) {
      case 'CASH': return '#28a745';
      case 'UPI': return '#007bff';
      case 'CARD': return '#6f42c1';
      default: return '#6c757d';
    }
  }

  // ── Print ──────────────────────────────────────────────────

  printBill(bill: Bill): void {
    if (!bill.billItems || bill.billItems.length === 0) {
      this.billService.getBill(bill.billId!).subscribe(full => this._doPrint(full));
    } else {
      this._doPrint(bill);
    }
  }

  private async _doPrint(bill: Bill): Promise<void> {
    // Try BLE thermal printer first
    if (this.printer.receiptConnected || await this.printer.reconnectReceipt()) {
      const ok = await this.printer.printReceipt(bill);
      if (ok) return;
    }
    // Fall back to browser print dialog
    this._openPrintWindow(bill);
  }

  private _openPrintWindow(bill: Bill): void {
    const w = window.open('', '_blank', 'width=360,height=650');
    if (!w) { alert('Please allow popups to print.'); return; }
    w.document.write(this.buildReceiptHtml(bill));
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  }

  private buildReceiptHtml(bill: Bill): string {
    const firmName  = this.settings.firmName  || 'SRISA FABRICS';
    const gstNumber = this.settings.gstNumber;
    const address   = this.settings.address;
    const dateStr = bill.billDate
      ? new Date(bill.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    const printTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const customerRows = bill.customer
      ? `<tr><td>Customer</td><td>${bill.customer.customerName || ''}</td></tr>
         ${bill.customer.phone ? `<tr><td>Phone</td><td>${bill.customer.phone}</td></tr>` : ''}`
      : '<tr><td>Customer</td><td>Walk-in</td></tr>';

    const itemRows = (bill.billItems || []).map((item, i) => {
      const name = item.product?.productName || item.itemDescription || '—';
      const unit = item.product?.unit || '';
      const qty = `${Number(item.quantity).toFixed(2)} ${unit}`.trim();
      const rate = Number(item.unitPrice).toFixed(2);
      const disc = Number(item.discountPct) > 0 ? ` <span style="font-size:9px">(-${item.discountPct}%)</span>` : '';
      const amt = Number(item.totalPrice).toFixed(2);
      return `<tr>
        <td>${i + 1}</td>
        <td class="item-name">${name}${disc}</td>
        <td class="r">${qty}</td>
        <td class="r">&#8377;${amt}</td>
      </tr>`;
    }).join('');

    const subtotal = Number(bill.subtotal || 0).toFixed(2);
    const gst = Number(bill.gstAmount || 0).toFixed(2);
    const total = Number(bill.totalAmount || 0).toFixed(2);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${bill.billNumber}</title>
<style>
  @page { size: 80mm auto; margin: 3mm 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    width: 70mm;
    color: #000;
    line-height: 1.5;
  }
  .store-name    { font-size: 16px; font-weight: bold; text-align: center; letter-spacing: 1px; margin-bottom: 1mm; }
  .store-sub     { font-size: 9px; text-align: center; margin-bottom: 1mm; }
  .store-address { font-size: 9px; text-align: center; margin-bottom: 2mm; line-height: 1.5; }
  .sep  { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  .sepp { border: none; border-top: 1px solid #000;  margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  .info td { padding: 1px 0; font-size: 11px; }
  .info td:first-child { width: 20mm; font-weight: bold; }
  .items thead tr th {
    font-size: 10px; padding: 2px 2px;
    border-top: 1px solid #000; border-bottom: 1px solid #000;
    text-align: left;
  }
  .items thead tr th.r { text-align: right; }
  .items tbody td { font-size: 11px; padding: 2px 2px; vertical-align: top; }
  .items tbody td.r { text-align: right; white-space: nowrap; }
  .item-name { word-break: break-word; }
  .totals td { padding: 1px 0; font-size: 11px; }
  .totals td:last-child { text-align: right; }
  .grand td { font-size: 14px; font-weight: bold; padding-top: 2mm; }
  .footer { text-align: center; font-size: 10px; line-height: 1.6; margin-top: 3mm; }
</style>
</head>
<body>
<div class="store-name">${firmName.toUpperCase()}</div>
${gstNumber ? `<div class="store-sub">GSTIN: ${gstNumber}</div>` : ''}
${address   ? `<div class="store-sub store-address">${address.replace(/\n/g, '<br>')}</div>` : ''}
<hr class="sepp">
<table class="info">
  <tr><td>Bill #</td><td>${bill.billNumber}</td></tr>
  <tr><td>Date</td><td>${dateStr}</td></tr>
  <tr><td>Payment</td><td>${bill.paymentMethod}</td></tr>
  ${customerRows}
</table>
<hr class="sepp">
<table class="items">
  <thead>
    <tr>
      <th style="width:5mm">#</th>
      <th>Item</th>
      <th class="r" style="width:18mm">Qty</th>
      <th class="r" style="width:18mm">Amount</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>
<hr class="sepp">
<table class="totals">
  <tr><td>Taxable Amount</td><td>&#8377;${subtotal}</td></tr>
  <tr><td>GST (5%)</td><td>&#8377;${gst}</td></tr>
</table>
<hr class="sepp">
<table class="totals grand">
  <tr><td>GRAND TOTAL</td><td>&#8377;${total}</td></tr>
</table>
<hr class="sep">
<div class="footer">
  *** Thank you! Visit Again! ***<br>
  <span style="font-size:9px">Printed: ${dateStr} ${printTime}</span>
</div>
<hr class="sep">
</body>
</html>`;
  }
}