import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoutiqueService, StitchingOrder, StitchingOrderItem, BoutiquePayment, ExtraCharge, CustomerMeasurement, BoutiqueOrderImage } from '../boutique.service';
import { BillService } from '../bill.service';
import { Customer } from '../customer.model';
import { ThermalPrinterService } from '../thermal-printer.service';
import { SettingsService } from '../settings.service';

type BoutiqueView = 'orders' | 'new-order' | 'measurements' | 'reports';
type StatusFilter = 'ALL' | 'RECEIVED' | 'CUTTING' | 'STITCHING' | 'FINISHING' | 'READY' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-boutique',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './boutique.component.html',
  styleUrl: './boutique.component.css'
})
export class BoutiqueComponent implements OnInit {
  view: BoutiqueView = 'orders';

  // Orders list
  orders: StitchingOrder[] = [];
  statusFilter: StatusFilter = 'ALL';
  orderSearch = '';
  loadingOrders = false;

  // Order detail modal
  selectedOrder: StitchingOrder | null = null;
  showOrderDetail = false;
  pendingStatus = '';
  updatingStatus = false;
  expandedDetailItems = new Set<number>();

  // Item images (keyed by itemId)
  itemImages: { [itemId: number]: BoutiqueOrderImage[] } = {};
  uploadingItemId: number | null = null;

  // Payment modal
  showPaymentModal = false;
  newPayment: BoutiquePayment = { amount: 0, paymentMethod: 'CASH', paymentType: 'PARTIAL' };
  savingPayment = false;

  // New customer modal (inline, from new-order form)
  showNewCustModal = false;
  newCustForm: { customerName: string; phone: string; address: string } = { customerName: '', phone: '', address: '' };
  savingNewCust = false;

  openNewCustModal() {
    this.newCustForm = { customerName: '', phone: '', address: '' };
    this.showNewCustModal = true;
  }

  saveNewCustomer() {
    if (!this.newCustForm.customerName.trim() && !this.newCustForm.phone.trim()) {
      alert('Please enter at least a name or phone number.');
      return;
    }
    this.savingNewCust = true;
    this.billService.createCustomer(this.newCustForm as Customer).subscribe({
      next: (c: Customer) => {
        this.customers.push(c);
        this.pickCustomer(c);
        this.showNewCustModal = false;
        this.savingNewCust = false;
      },
      error: () => { this.savingNewCust = false; }
    });
  }

  // Extra charge modal
  showExtraChargeModal = false;
  newExtraCharge: ExtraCharge = { description: '', amount: 0 };
  savingExtraCharge = false;

  // Print work order garment picker
  showPrintPickerModal = false;
  printItemIdx: number | null = null;

  // New order form
  editingOrderId: number | null = null;
  customers: Customer[] = [];
  customerSearch = '';
  filteredCustomers: Customer[] = [];
  showCustomerDropdown = false;
  selectedCustomer: Customer | null = null;
  customerMeasurements: CustomerMeasurement[] = [];
  orderForm: StitchingOrder = this.blankOrder();
  formItems: StitchingOrderItem[] = [];
  itemMeasExpanded: boolean[] = [];
  saving = false;

  // Measurements
  measSearch = '';
  measFilteredCustomers: Customer[] = [];
  showMeasDropdown = false;
  selectedMeasCustomer: Customer | null = null;
  measurements: CustomerMeasurement[] = [];
  editingMeas: CustomerMeasurement | null = null;
  showMeasModal = false;
  savingMeas = false;

  // Reports
  summary: any = null;
  loadingReports = false;

  readonly statuses: StatusFilter[] = ['ALL','RECEIVED','CUTTING','STITCHING','FINISHING','READY','DELIVERED','CANCELLED'];
  readonly garmentTypes = ['Blouse','Skirt','Frock','Salwar','Kurta','Kurti','Lehenga','Choli','Anarkali','Palazzo','Suit','Shirt','Trouser','Saree Fall','Other'];
  garmentDropdownIdx = -1;
  highlightedGarmentIdx = -1;
  readonly waistFinishOptions = ['Elastic','Zip','Hook & Eye','Drawstring','Belt','Other'];
  readonly priorities = ['NORMAL','URGENT','EXPRESS'];
  readonly paymentMethods = ['CASH','UPI','CARD','BANK_TRANSFER'];
  readonly paymentTypes = ['ADVANCE','PARTIAL','FINAL'];
  readonly bustShapeOptions = ['High Bust','Low Bust','Broad Bust','Uneven Shoulders','Posture Alignment'];

  constructor(
    private boutiqueService: BoutiqueService,
    private billService: BillService,
    private printer: ThermalPrinterService,
    private settingsService: SettingsService
  ) {}

  get firmDisplayName(): string {
    return this.settingsService.firmName || 'Srisa Fabrics';
  }

  get gstNumber(): string {
    return this.settingsService.gstNumber;
  }

  get shopAddress(): string {
    return this.settingsService.address;
  }

  ngOnInit() {
    this.loadOrders();
    this.loadCustomers();
  }

  setView(v: BoutiqueView) {
    this.view = v;
    if (v === 'reports' && !this.summary) this.loadSummary();
  }

  // ── Orders ────────────────────────────────────────────

  loadOrders() {
    this.loadingOrders = true;
    this.boutiqueService.getOrders(this.statusFilter).subscribe({
      next: o => { this.orders = o; this.loadingOrders = false; },
      error: () => { this.loadingOrders = false; }
    });
  }

  setStatusFilter(s: StatusFilter) {
    this.statusFilter = s;
    this.loadOrders();
  }

  get filteredOrders(): StitchingOrder[] {
    const q = this.orderSearch.trim().toLowerCase();
    if (!q) return this.orders;
    return this.orders.filter(o =>
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customer?.customerName?.toLowerCase().includes(q)
    );
  }

  openOrder(o: StitchingOrder) {
    this.expandedDetailItems.clear();
    this.itemImages = {};
    this.boutiqueService.getOrder(o.orderId!).subscribe(full => {
      this.selectedOrder = full;
      this.pendingStatus = full.status || '';
      this.showOrderDetail = true;
      (full.items || []).forEach((item, i) => {
        if (this.hasMeasurements(item)) this.expandedDetailItems.add(i);
        if (item.itemId) {
          this.boutiqueService.getItemImages(item.itemId).subscribe(imgs => {
            this.itemImages[item.itemId!] = imgs;
          });
        }
      });
    });
  }

  closeOrderDetail() {
    this.showOrderDetail = false;
    this.selectedOrder = null;
    this.itemImages = {};
    this.expandedDetailItems.clear();
  }

  getItemImages(itemId: number | undefined): BoutiqueOrderImage[] {
    if (!itemId) return [];
    return this.itemImages[itemId] || [];
  }

  onItemImageFileSelect(event: Event, itemId: number) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';
    this.uploadingItemId = itemId;
    this.boutiqueService.uploadToCloudinary(file).subscribe({
      next: res => {
        this.boutiqueService.saveItemImage(itemId, res.secure_url, res.public_id).subscribe({
          next: img => {
            if (!this.itemImages[itemId]) this.itemImages[itemId] = [];
            this.itemImages[itemId].push(img);
            this.uploadingItemId = null;
          },
          error: () => { this.uploadingItemId = null; }
        });
      },
      error: () => { this.uploadingItemId = null; }
    });
  }

  deleteItemImage(img: BoutiqueOrderImage, itemId: number) {
    this.boutiqueService.deleteItemImage(itemId, img.imageId!).subscribe(() => {
      this.itemImages[itemId] = (this.itemImages[itemId] || []).filter(i => i.imageId !== img.imageId);
    });
  }

  toggleDetailItem(i: number) {
    if (this.expandedDetailItems.has(i)) this.expandedDetailItems.delete(i);
    else this.expandedDetailItems.add(i);
  }

  hasMeasurements(item: StitchingOrderItem): boolean {
    return !!(item.chest || item.waist || item.hip || item.shoulder ||
      item.sleeveLength || item.blouseLength || item.armhole ||
      item.neckFrontDepth || item.neckBackDepth || item.neckWidth ||
      item.kurtaLength || item.salwarLength || item.fullLength ||
      item.upperBust || item.underBust || item.sleeveRound || item.bicepRound ||
      item.elbowRound || item.wristRound || item.apexPoint || item.apexToApex ||
      item.shoulderToApex || item.shoulderToUnderBust || item.frontLength ||
      item.backLength || item.frontWidth || item.backWidth || item.sideSeamLength ||
      item.strapWidth || item.princessLineLength || item.cupSizePadding ||
      item.bustShapeObservation ||
      item.highWaistRound || item.lowWaistRound || item.seatRound ||
      item.thighRound || item.kneeRound || item.calfRound || item.bottomRound ||
      item.waistToHipLength || item.waistToKnee || item.slitHeight ||
      item.canCanRequirement || item.waistFinish || item.waistGather ||
      item.ankleRound || item.inseamLength || item.riseLength || item.crotchDepth ||
      item.collarRound || item.frontSlitLength || item.kaliWidth ||
      item.numberOfKalis || item.trailLength ||
      item.underBustBeltLength || item.backOpeningLength ||
      item.waistJointLength || item.kaliLength ||
      item.midThighRound || item.frontRise || item.backRise || item.waistbandWidth ||
      item.boutiqueObservations ||
      item.specialInstructions);
  }

  applyStatus() {
    if (!this.selectedOrder || !this.pendingStatus) return;
    this.updatingStatus = true;
    this.boutiqueService.updateStatus(this.selectedOrder.orderId!, this.pendingStatus).subscribe({
      next: updated => {
        this.selectedOrder = updated;
        this.pendingStatus = updated.status || '';
        this.loadOrders();
        this.updatingStatus = false;
      },
      error: () => { this.updatingStatus = false; }
    });
  }

  openPaymentModal() {
    this.newPayment = { amount: 0, paymentMethod: 'CASH', paymentType: 'PARTIAL' };
    this.showPaymentModal = true;
  }

  savePayment() {
    if (!this.selectedOrder || !this.newPayment.amount) return;
    this.savingPayment = true;
    this.boutiqueService.addPayment(this.selectedOrder.orderId!, this.newPayment).subscribe({
      next: updated => {
        this.selectedOrder = updated;
        this.loadOrders();
        this.showPaymentModal = false;
        this.savingPayment = false;
      },
      error: () => { this.savingPayment = false; }
    });
  }

  confirmDeleteOrder() {
    if (!this.selectedOrder) return;
    if (!confirm('Delete order ' + this.selectedOrder.orderNumber + '? This cannot be undone.')) return;
    this.boutiqueService.deleteOrder(this.selectedOrder.orderId!).subscribe(() => {
      this.closeOrderDetail();
      this.loadOrders();
    });
  }

  async printBill() {
    if (!this.selectedOrder) return;
    if (this.printer.connected || await this.printer.reconnect()) {
      const ok = await this.printer.printBoutiqueOrder(this.selectedOrder);
      if (ok) return;
    }
    // Fall back to browser print dialog
    document.body.classList.add('print-bill-mode');
    window.addEventListener('afterprint', () => document.body.classList.remove('print-bill-mode'), { once: true });
    window.print();
  }

  printOrder() { this.openPrintOrderPicker(); }

  get todayStr(): string {
    return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  readonly workStages = [
    { key: 'RECEIVED',  label: 'Received from Customer' },
    { key: 'CUTTING',   label: 'Cutting' },
    { key: 'STITCHING', label: 'Stitching' },
    { key: 'FINISHING', label: 'Finishing / Ironing' },
    { key: 'READY',     label: 'Ready for Delivery' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  // ── New Order ─────────────────────────────────────────

  loadCustomers() {
    this.billService.getCustomers().subscribe(c => this.customers = c);
  }

  filterCustomers(q: string) {
    this.customerSearch = q;
    if (!q.trim()) { this.filteredCustomers = []; this.showCustomerDropdown = false; return; }
    this.filteredCustomers = this.customers.filter(c =>
      c.customerName?.toLowerCase().includes(q.toLowerCase()) ||
      c.phone?.includes(q)
    ).slice(0, 8);
    this.showCustomerDropdown = this.filteredCustomers.length > 0;
  }

  pickCustomer(c: Customer) {
    this.selectedCustomer = c;
    this.customerSearch = c.customerName || '';
    this.showCustomerDropdown = false;
    this.orderForm.customer = { customerId: c.customerId!, customerName: c.customerName || '', phone: c.phone };
    this.boutiqueService.getMeasurements(c.customerId!).subscribe(m => this.customerMeasurements = m);
  }

  addItem() {
    this.formItems.push({ garmentType: 'Blouse', quantity: 1, stitchingCharges: 0 });
    this.itemMeasExpanded.push(false);
  }

  removeItem(i: number) {
    this.formItems.splice(i, 1);
    this.itemMeasExpanded.splice(i, 1);
  }

  toggleItemMeas(i: number) {
    this.itemMeasExpanded[i] = !this.itemMeasExpanded[i];
  }

  applyMeasToItem(m: CustomerMeasurement, item: StitchingOrderItem) {
    // Generic
    item.chest = m.chest; item.waist = m.waist; item.hip = m.hip;
    item.shoulder = m.shoulder; item.sleeveLength = m.sleeveLength;
    item.blouseLength = m.blouseLength; item.armhole = m.armhole;
    item.neckFrontDepth = m.neckFrontDepth; item.neckBackDepth = m.neckBackDepth;
    item.neckWidth = m.neckWidth; item.kurtaLength = m.kurtaLength;
    item.salwarLength = m.salwarLength; item.fullLength = m.fullLength;
    // Blouse-specific
    item.upperBust = m.upperBust; item.underBust = m.underBust;
    item.sleeveRound = m.sleeveRound; item.bicepRound = m.bicepRound;
    item.elbowRound = m.elbowRound; item.wristRound = m.wristRound;
    item.apexPoint = m.apexPoint; item.apexToApex = m.apexToApex;
    item.shoulderToApex = m.shoulderToApex; item.shoulderToUnderBust = m.shoulderToUnderBust;
    item.frontLength = m.frontLength; item.backLength = m.backLength;
    item.frontWidth = m.frontWidth; item.backWidth = m.backWidth;
    item.sideSeamLength = m.sideSeamLength; item.strapWidth = m.strapWidth;
    item.princessLineLength = m.princessLineLength;
    item.cupSizePadding = m.cupSizePadding;
    item.bustShapeObservation = m.bustShapeObservation;
    // Skirt
    item.highWaistRound = m.highWaistRound; item.lowWaistRound = m.lowWaistRound;
    item.seatRound = m.seatRound; item.thighRound = m.thighRound;
    item.kneeRound = m.kneeRound; item.calfRound = m.calfRound;
    item.bottomRound = m.bottomRound; item.waistToHipLength = m.waistToHipLength;
    item.waistToKnee = m.waistToKnee; item.slitHeight = m.slitHeight;
    item.canCanRequirement = m.canCanRequirement; item.waistFinish = m.waistFinish;
    item.waistGather = m.waistGather;
    // Salwar
    item.ankleRound = m.ankleRound; item.inseamLength = m.inseamLength;
    item.riseLength = m.riseLength; item.crotchDepth = m.crotchDepth;
    // Kurta/Kurti
    item.collarRound = m.collarRound; item.frontSlitLength = m.frontSlitLength;
    item.kaliWidth = m.kaliWidth;
    // Lehenga
    item.numberOfKalis = m.numberOfKalis; item.trailLength = m.trailLength;
    // Choli
    item.underBustBeltLength = m.underBustBeltLength; item.backOpeningLength = m.backOpeningLength;
    // Anarkali
    item.waistJointLength = m.waistJointLength; item.kaliLength = m.kaliLength;
    // Trouser
    item.midThighRound = m.midThighRound; item.frontRise = m.frontRise;
    item.backRise = m.backRise; item.waistbandWidth = m.waistbandWidth;
    // Advanced
    item.boutiqueObservations = m.boutiqueObservations;
  }

  getFilteredGarmentTypes(i: number): string[] {
    const term = (this.formItems[i]?.garmentType || '').toLowerCase().trim();
    if (!term) return this.garmentTypes;
    return this.garmentTypes.filter(g => g.toLowerCase().includes(term));
  }

  selectGarmentType(i: number, type: string) {
    this.formItems[i].garmentType = type;
    this.garmentDropdownIdx = -1;
    this.highlightedGarmentIdx = -1;
  }

  onGarmentBlur() {
    setTimeout(() => { this.garmentDropdownIdx = -1; this.highlightedGarmentIdx = -1; }, 200);
  }

  onGarmentKeydown(event: KeyboardEvent, i: number) {
    const types = this.getFilteredGarmentTypes(i);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.garmentDropdownIdx = i;
      this.highlightedGarmentIdx = Math.min(this.highlightedGarmentIdx + 1, types.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedGarmentIdx = Math.max(this.highlightedGarmentIdx - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightedGarmentIdx >= 0 && this.highlightedGarmentIdx < types.length) {
        this.selectGarmentType(i, types[this.highlightedGarmentIdx]);
      }
    } else if (event.key === 'Escape') {
      this.garmentDropdownIdx = -1;
      this.highlightedGarmentIdx = -1;
    }
  }

  isBustShapeSelected(obs: string | undefined, option: string): boolean {
    return (obs || '').split(',').map(s => s.trim()).includes(option);
  }

  toggleBustShape(item: StitchingOrderItem | CustomerMeasurement, option: string) {
    const current = new Set((item.bustShapeObservation || '').split(',').map(s => s.trim()).filter(Boolean));
    if (current.has(option)) current.delete(option);
    else current.add(option);
    item.bustShapeObservation = Array.from(current).join(', ');
  }

  get orderTotal(): number {
    return this.formItems.reduce((s, i) => s + (+(i.stitchingCharges) || 0) * (+(i.quantity) || 1), 0);
  }

  blankOrder(): StitchingOrder {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return { priority: 'NORMAL', items: [], deliveryDate: d.toISOString().split('T')[0] };
  }

  startNewOrder() {
    this.editingOrderId = null;
    this.orderForm = this.blankOrder();
    this.formItems = [];
    this.itemMeasExpanded = [];
    this.selectedCustomer = null;
    this.customerSearch = '';
    this.customerMeasurements = [];
    this.addItem();
    this.view = 'new-order';
  }

  startEditOrder() {
    if (!this.selectedOrder) return;
    this.editingOrderId = this.selectedOrder.orderId!;
    this.orderForm = {
      priority: this.selectedOrder.priority,
      deliveryDate: this.selectedOrder.deliveryDate,
      notes: this.selectedOrder.notes,
      items: []
    };
    this.formItems = (this.selectedOrder.items || []).map(item => ({ ...item }));
    this.itemMeasExpanded = this.formItems.map(() => false);
    this.selectedCustomer = {
      customerId: this.selectedOrder.customer?.customerId,
      customerName: this.selectedOrder.customer?.customerName,
      phone: this.selectedOrder.customer?.phone
    } as Customer;
    this.customerSearch = this.selectedOrder.customer?.customerName || '';
    this.customerMeasurements = [];
    if (this.selectedOrder.customer?.customerId) {
      this.boutiqueService.getMeasurements(this.selectedOrder.customer.customerId)
        .subscribe(m => this.customerMeasurements = m);
    }
    this.showOrderDetail = false;
    this.view = 'new-order';
  }

  cancelForm() {
    this.editingOrderId = null;
    this.view = 'orders';
  }

  submitOrder() {
    if (!this.selectedCustomer) { alert('Please select a customer'); return; }
    if (!this.formItems.length) { alert('Add at least one garment item'); return; }
    const order: StitchingOrder = {
      ...this.orderForm,
      customer: { customerId: this.selectedCustomer.customerId! },
      items: [...this.formItems]
    };
    this.saving = true;
    if (this.editingOrderId) {
      this.boutiqueService.updateOrder(this.editingOrderId, order).subscribe({
        next: updated => {
          this.saving = false;
          this.editingOrderId = null;
          this.view = 'orders';
          this.loadOrders();
          setTimeout(() => this.openOrder(updated), 400);
        },
        error: err => {
          this.saving = false;
          alert('Error updating order: ' + (err.error || 'Please check all fields'));
        }
      });
    } else {
      this.boutiqueService.createOrder(order).subscribe({
        next: created => {
          this.saving = false;
          this.view = 'orders';
          this.loadOrders();
          setTimeout(() => this.openOrder(created), 400);
        },
        error: err => {
          this.saving = false;
          alert('Error creating order: ' + (err.error || 'Please check all fields'));
        }
      });
    }
  }

  openExtraChargeModal() {
    this.newExtraCharge = { description: '', amount: 0 };
    this.showExtraChargeModal = true;
  }

  saveExtraCharge() {
    if (!this.selectedOrder || !this.newExtraCharge.description || !this.newExtraCharge.amount) return;
    this.savingExtraCharge = true;
    this.boutiqueService.addExtraCharge(this.selectedOrder.orderId!, this.newExtraCharge).subscribe({
      next: updated => {
        this.selectedOrder = updated;
        this.loadOrders();
        this.showExtraChargeModal = false;
        this.savingExtraCharge = false;
      },
      error: () => { this.savingExtraCharge = false; }
    });
  }

  openPrintOrderPicker() {
    if (!this.selectedOrder) return;
    if ((this.selectedOrder.items || []).length <= 1) {
      this.printItemIdx = null;
      this.doPrintOrder();
    } else {
      this.showPrintPickerModal = true;
    }
  }

  selectAndPrintItem(idx: number | null) {
    this.printItemIdx = idx;
    this.showPrintPickerModal = false;
    setTimeout(() => this.doPrintOrder(), 60);
  }

  doPrintOrder() {
    const printEl = document.querySelector('.print-work-order') as HTMLElement;
    if (!printEl) return;
    // Teleport to body root so page-breaks work (position:fixed blocks them)
    const marker = document.createComment('pwo-placeholder');
    printEl.parentNode!.insertBefore(marker, printEl);
    document.body.appendChild(printEl);
    document.body.classList.add('print-order-mode');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('print-order-mode');
      marker.parentNode!.insertBefore(printEl, marker);
      marker.parentNode!.removeChild(marker);
      this.printItemIdx = null;
    }, { once: true });
    window.print();
  }

  // ── Measurements ─────────────────────────────────────

  filterMeasCustomers(q: string) {
    this.measSearch = q;
    if (!q.trim()) { this.measFilteredCustomers = []; this.showMeasDropdown = false; return; }
    this.measFilteredCustomers = this.customers.filter(c =>
      c.customerName?.toLowerCase().includes(q.toLowerCase()) ||
      c.phone?.includes(q)
    ).slice(0, 8);
    this.showMeasDropdown = this.measFilteredCustomers.length > 0;
  }

  pickMeasCustomer(c: Customer) {
    this.selectedMeasCustomer = c;
    this.measSearch = c.customerName || '';
    this.showMeasDropdown = false;
    this.boutiqueService.getMeasurements(c.customerId!).subscribe(m => this.measurements = m);
  }

  openMeasModal(m?: CustomerMeasurement) {
    this.editingMeas = m
      ? { ...m }
      : { customer: { customerId: this.selectedMeasCustomer!.customerId! }, profileName: 'Default' };
    this.showMeasModal = true;
  }

  saveMeas() {
    if (!this.editingMeas) return;
    this.savingMeas = true;
    this.boutiqueService.saveMeasurement(this.editingMeas).subscribe({
      next: () => {
        this.savingMeas = false;
        this.showMeasModal = false;
        this.boutiqueService.getMeasurements(this.selectedMeasCustomer!.customerId!)
          .subscribe(m => this.measurements = m);
      },
      error: () => { this.savingMeas = false; }
    });
  }

  deleteMeas(id: number) {
    if (!confirm('Delete this measurement profile?')) return;
    this.boutiqueService.deleteMeasurement(id).subscribe(() => {
      this.boutiqueService.getMeasurements(this.selectedMeasCustomer!.customerId!)
        .subscribe(m => this.measurements = m);
    });
  }

  // ── Reports ────────────────────────────────────────────

  loadSummary() {
    this.loadingReports = true;
    this.boutiqueService.getSummary().subscribe({
      next: s => { this.summary = s; this.loadingReports = false; },
      error: () => { this.loadingReports = false; }
    });
  }

  get totalOrderCount(): number {
    if (!this.summary?.statusCounts) return 1;
    return Math.max(1, Object.values(this.summary.statusCounts as Record<string,number>)
      .reduce((s, v) => s + v, 0));
  }

  get statusCountsArr(): { status: string; count: number }[] {
    if (!this.summary?.statusCounts) return [];
    return Object.entries(this.summary.statusCounts as Record<string,number>)
      .map(([status, count]) => ({ status, count }));
  }

  // ── Helpers ───────────────────────────────────────────

  statusClass(s: string): string {
    const m: Record<string, string> = {
      RECEIVED: 'status-received', CUTTING: 'status-cutting', STITCHING: 'status-stitching',
      FINISHING: 'status-finishing', READY: 'status-ready', DELIVERED: 'status-delivered',
      CANCELLED: 'status-cancelled'
    };
    return m[s] || '';
  }

  priorityClass(p: string): string {
    return p === 'URGENT' ? 'priority-urgent' : p === 'EXPRESS' ? 'priority-express' : 'priority-normal';
  }

  isOverdue(o: StitchingOrder): boolean {
    if (!o.deliveryDate || o.status === 'DELIVERED' || o.status === 'CANCELLED') return false;
    return new Date(o.deliveryDate + 'T00:00:00') < new Date(new Date().toDateString());
  }

  fmtDate(d?: string): string {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  monthName(n: number): string {
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][n - 1] || '';
  }

  trackByIdx(i: number) { return i; }
}
