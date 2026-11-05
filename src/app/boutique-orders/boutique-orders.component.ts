import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

/** Row of GET /api/boutique-orders (made-to-order boutique orders placed through the WhatsApp agent). */
export interface BoutiqueOrderSummary {
  order_no: string;
  status: string;
  channel: string;
  customer_id: number;
  customer_name: string | null;
  customer_phone: string | null;
  design_code: string | null;
  design_name: string | null;
  size_code: string | null;
  qty: number;
  total: number;
  currency: string;
  estimated_delivery_date: string | null;
  payment_status: string | null;
  paid_at: string | null;
  razorpay_payment_id: string | null;
  measurement_status: string | null;   // PENDING_CALL | TAKEN | null
  created_at: string;
  order_type?: string;                 // GARMENT | FABRIC | READYMADE | MIXED
  fabric_metres?: number | null;
  item_count?: number;
}

export interface BoutiqueOrderPayment {
  status: string;              // created | paid | expired | cancelled
  short_url: string | null;
  amount: number;
  expires_at: string | null;
  paid_at: string | null;
  razorpay_payment_id: string | null;
  needs_review: boolean;
}

export interface BoutiqueOrderOption {
  option_id: number;
  option_group: string;
  name: string;
  price_delta: number;
}

export interface CourierPlan {
  enabled: boolean;
  contents_grams: number | null;
  cover: string | null;
  covers: string[];
  parcel_grams: number | null;
  chargeable_grams: number | null;
  estimated_cost: number | null;
  missing: string | null;
}

/** GET /api/boutique-orders/{no}/supplier: the supplier side of a dropship order. */
export interface SupplierView {
  supplier_name: string | null;
  supplier_phone: string | null;
  supplier_payment_details: string | null;
  zone: string | null;
  cost: number;
  courier: number;
  payable: number;
  customer_paid: number;
  margin: number;
  sent_at: string | null;
  paid_at: string | null;
  paid_ref: string | null;
  paid_by: string | null;
  message: string;
  whatsapp_url: string | null;
}

export interface BoutiqueOrderDetail {
  order_no: string;
  status: string;
  order_type?: string;
  customer_id: number;
  channel: string;
  delivery: {
    name: string; phone: string; address_line1: string; address_line2: string | null;
    city: string; state: string; pincode: string;
  };
  items: {
    design_code: string; design_name: string; size_code: string;
    options: BoutiqueOrderOption[];
    measurements: { [key: string]: any } | null;
    unit_price: number; qty: number; line_total: number;
    fabric_metres?: number | null; fabric_price_per_metre?: number | null;
    item_kind?: string | null; item_code?: string | null;
  }[];
  subtotal: number;
  delivery_charge: number;
  total: number;
  currency: string;
  estimated_delivery_date: string | null;
  courier?: string | null;
  awb?: string | null;
  tracking_url?: string | null;
  courier_status?: string | null;
  courier_location?: string | null;
  courier_status_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  ship_weight_grams?: number | null;
  paid_at: string | null;
  payment: BoutiqueOrderPayment | null;
  source_type: string | null;
  source_id: string | null;
  measurement_status: string | null;
  measurement_taken_at: string | null;
  measurement_taken_by: string | null;
  created_at: string;
}

type StatusFilter = 'ALL' | 'MEASURE' | 'DISPATCH' | 'DRAFT' | 'PAYMENT_PENDING' | 'PAID' | 'IN_STITCHING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-boutique-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './boutique-orders.component.html',
  styleUrl: './boutique-orders.component.css'
})
export class BoutiqueOrdersComponent implements OnInit {
  /** Opened from a staff alert link (?order=SB-1023). */
  @Input() initialOrderNo: string | null = null;
  markingTaken = false;
  orders: BoutiqueOrderSummary[] = [];
  loading = false;
  error = '';
  statusFilter: StatusFilter = 'ALL';
  searchQuery = '';

  expandedOrderNo: string | null = null;
  details: { [orderNo: string]: BoutiqueOrderDetail } = {};
  loadingDetail: string | null = null;

  readonly statuses: StatusFilter[] = ['ALL', 'MEASURE', 'DISPATCH', 'DRAFT', 'PAYMENT_PENDING', 'PAID', 'IN_STITCHING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
  readonly statusLabel: { [s: string]: string } = {
    'MEASURE':      '📏 Measurements pending',
    'DISPATCH':     '📦 To dispatch',
    'DRAFT':        'Draft',
    'PAYMENT_PENDING': 'Payment Pending',
    'PAID':         'Paid (tailor queue)',
    'IN_STITCHING': 'In Stitching',
    'DISPATCHED':   'Dispatched',
    'DELIVERED':    'Delivered',
    'CANCELLED':    'Cancelled'
  };
  readonly statusColor: { [s: string]: string } = {
    'DRAFT':        '#9ca3af',
    'PAYMENT_PENDING': '#a855f7',
    'PAID':         '#f59e0b',
    'IN_STITCHING': '#3b82f6',
    'DISPATCHED':   '#06b6d4',
    'DELIVERED':    '#10b981',
    'CANCELLED':    '#ef4444'
  };
  /** Measurement snapshot keys shown in the detail view, in this order. */
  readonly measurementFields: { key: string; label: string; unit: string }[] = [
    { key: 'size_code', label: 'Size', unit: '' },
    { key: 'height_cm', label: 'Height', unit: ' cm' },
    { key: 'bust_in', label: 'Bust', unit: '"' },
    { key: 'waist_in', label: 'Waist', unit: '"' },
    { key: 'hip_in', label: 'Hip', unit: '"' },
    { key: 'fit_preference', label: 'Fit', unit: '' },
    { key: 'notes', label: 'Notes', unit: '' }
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
    if (this.initialOrderNo) this.toggleExpand(this.initialOrderNo);
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('mybill_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  load() {
    this.loading = true;
    this.error = '';
    const params: any = { limit: 100 };
    if (this.statusFilter === 'MEASURE') params['measurement'] = 'pending';
    else if (this.statusFilter === 'DISPATCH') params['dispatch'] = 'pending';
    else if (this.statusFilter !== 'ALL') params['status'] = this.statusFilter;

    this.http.get<BoutiqueOrderSummary[]>('/api/boutique-orders', { headers: this.headers(), params }).subscribe({
      next: orders => { this.orders = orders; this.loading = false; },
      error: err => { this.loading = false; this.error = err?.error?.message || 'Could not load boutique orders'; }
    });
  }

  setFilter(s: StatusFilter) {
    this.statusFilter = s;
    this.expandedOrderNo = null;
    this.load();
  }

  toggleExpand(orderNo: string) {
    this.expandedOrderNo = this.expandedOrderNo === orderNo ? null : orderNo;
    if (this.expandedOrderNo && !this.details[orderNo]) this.loadDetail(orderNo);
  }

  private loadDetail(orderNo: string) {
    this.loadingDetail = orderNo;
    this.http.get<BoutiqueOrderDetail>(`/api/boutique-orders/${encodeURIComponent(orderNo)}`,
      { headers: this.headers() }).subscribe({
      next: d => { this.details[orderNo] = d; this.loadingDetail = null; if (d.order_type === 'DROPSHIP') this.loadSupplier(orderNo); },
      error: () => { this.loadingDetail = null; }
    });
  }

  /** Measurement rows that have a value; source tells whether they came with the order or from the saved profile. */
  measurementRows(m: { [key: string]: any } | null): { label: string; value: string }[] {
    if (!m) return [];
    return this.measurementFields
      .filter(f => m[f.key] !== null && m[f.key] !== undefined && m[f.key] !== '')
      .map(f => ({ label: f.label, value: `${m[f.key]}${f.unit}` }));
  }

  readonly paymentLabel: { [s: string]: string } = {
    'created': 'Link sent', 'paid': 'Paid', 'expired': 'Link expired', 'cancelled': 'Link cancelled'
  };

  /** The tailor has called the customer and taken her exact measurements. */
  markMeasurementsTaken(orderNo: string) {
    if (!confirm(`Mark exact measurements as taken for ${orderNo}?`)) return;
    this.markingTaken = true;
    this.http.post<BoutiqueOrderDetail>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/measurements-taken`, {},
      { headers: this.headers() }).subscribe({
      next: d => {
        this.markingTaken = false;
        this.details[orderNo] = d;
        const row = this.orders.find(o => o.order_no === orderNo);
        if (row) row.measurement_status = d.measurement_status;
        if (this.statusFilter === 'MEASURE') this.orders = this.orders.filter(o => o.order_no !== orderNo);
      },
      error: err => { this.markingTaken = false; alert(err?.error?.message || 'Could not update the order'); }
    });
  }

  /** Fabric / readymade orders: packed and dispatched from stock (no stitching). */
  isGoods(o: { order_type?: string }): boolean {
    return !!o.order_type && o.order_type !== 'GARMENT';
  }

  readonly goodsLabel: { [t: string]: string } = { FABRIC: '🧵 Fabric', READYMADE: '👗 Readymade', MIXED: '📦 Fabric + readymade',
                                                   DROPSHIP: '🛒 Dropship' };

  // ── Dropship: the supplier ships it ──────────────────────────────────────

  supplier: { [orderNo: string]: SupplierView } = {};
  supplierBusy = false;
  payRef = '';
  shipFor: string | null = null;               // order whose "enter tracking" form is open
  ship = { courier: '', awb: '', tracking_url: '' };
  shipError = '';

  loadSupplier(orderNo: string) {
    this.http.get<SupplierView>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/supplier`, { headers: this.headers() })
      .subscribe({ next: v => this.supplier[orderNo] = v, error: () => {} });
  }

  /** Opens WhatsApp with the order for the supplier, and notes that it was sent. */
  sendToSupplier(orderNo: string) {
    const v = this.supplier[orderNo];
    if (!v?.whatsapp_url) return;
    window.open(v.whatsapp_url, '_blank');
    this.http.post<SupplierView>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/supplier/sent`, {}, { headers: this.headers() })
      .subscribe({ next: r => this.supplier[orderNo] = r, error: () => {} });
  }

  copySupplierMessage(orderNo: string) {
    const v = this.supplier[orderNo];
    if (v) navigator.clipboard?.writeText(v.message).then(() => alert('Order copied – paste it in the supplier chat'));
  }

  markSupplierPaid(orderNo: string) {
    const v = this.supplier[orderNo];
    if (!v || !confirm(`Paid ₹${v.payable} to ${v.supplier_name || 'the supplier'} for ${orderNo}?`)) return;
    this.supplierBusy = true;
    this.http.post<SupplierView>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/supplier/paid`,
      { reference: this.payRef.trim() || null }, { headers: this.headers() }).subscribe({
      next: r => { this.supplierBusy = false; this.supplier[orderNo] = r; this.payRef = ''; },
      error: err => { this.supplierBusy = false; alert(err?.error?.message || 'Could not save'); }
    });
  }

  openShip(orderNo: string) {
    this.shipFor = orderNo;
    this.ship = { courier: '', awb: '', tracking_url: '' };
    this.shipError = '';
  }

  /** Tracking number from the supplier (or another courier): the customer gets it on WhatsApp. */
  saveShipment() {
    if (!this.shipFor) return;
    const orderNo = this.shipFor;
    if (!confirm(`Send ${this.ship.courier} tracking ${this.ship.awb} to the customer of ${orderNo}?`)) return;
    this.courierBusy = true;
    this.shipError = '';
    this.http.post<BoutiqueOrderDetail>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/shipment`, this.ship,
      { headers: this.headers() }).subscribe({
      next: d => { this.courierBusy = false; this.shipFor = null; this.updateRow(orderNo, d); },
      error: err => { this.courierBusy = false; this.shipError = err?.error?.message || 'Could not save the tracking number'; }
    });
  }

  markDelivered(orderNo: string) {
    if (!confirm(`Mark ${orderNo} as delivered? The customer gets a "delivered" message.`)) return;
    this.http.post<BoutiqueOrderDetail>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/delivered`, {},
      { headers: this.headers() }).subscribe({
      next: d => this.updateRow(orderNo, d),
      error: err => alert(err?.error?.message || 'Could not update the order')
    });
  }

  /** Delhivery parcels are tracked automatically; other couriers are marked delivered by staff. */
  isDelhivery(d: BoutiqueOrderDetail): boolean {
    return !d.courier || d.courier.toUpperCase() === 'DELHIVERY';
  }

  marking = false;

  /** Staff packed and sent the order. */
  markDispatched(orderNo: string) {
    if (!confirm(`Mark ${orderNo} as dispatched?`)) return;
    this.marking = true;
    this.http.post<BoutiqueOrderDetail>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/dispatched`, {},
      { headers: this.headers() }).subscribe({
      next: d => {
        this.marking = false;
        this.details[orderNo] = d;
        const row = this.orders.find(o => o.order_no === orderNo);
        if (row) row.status = d.status;
        if (this.statusFilter === 'DISPATCH') this.orders = this.orders.filter(o => o.order_no !== orderNo);
      },
      error: err => { this.marking = false; alert(err?.error?.message || 'Could not update the order'); }
    });
  }

  // ── Courier (Delhivery) ──────────────────────────────────────────────────

  courierFor: string | null = null;            // order whose booking form is open
  courierPlan: CourierPlan | null = null;
  courierWeight: number | null = null;         // contents grams typed by staff (overrides the items' weight)
  courierCover = '';
  courierBusy = false;
  courierError = '';

  openCourier(orderNo: string) {
    this.courierFor = orderNo;
    this.courierPlan = null;
    this.courierWeight = null;
    this.courierCover = '';
    this.courierError = '';
    this.refreshCourierPlan();
  }

  refreshCourierPlan() {
    if (!this.courierFor) return;
    const params: { [k: string]: string } = {};
    if (this.courierWeight) params['weight'] = String(this.courierWeight);
    if (this.courierCover) params['cover'] = this.courierCover;
    this.courierBusy = true;
    this.http.get<CourierPlan>(`/api/boutique-orders/${encodeURIComponent(this.courierFor)}/courier/plan`,
      { headers: this.headers(), params }).subscribe({
      next: p => {
        this.courierBusy = false;
        this.courierPlan = p;
        if (!this.courierCover && p.cover) this.courierCover = p.cover;
        if (this.courierWeight == null && p.contents_grams) this.courierWeight = p.contents_grams;
      },
      error: err => { this.courierBusy = false; this.courierError = err?.error?.message || 'Could not get the parcel details'; }
    });
  }

  bookCourier() {
    if (!this.courierFor) return;
    const orderNo = this.courierFor;
    if (!confirm(`Book Delhivery pickup for ${orderNo}? The customer gets the tracking link on WhatsApp.`)) return;
    this.courierBusy = true;
    this.courierError = '';
    this.http.post<BoutiqueOrderDetail>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/courier`,
      { weight_grams: this.courierWeight, cover: this.courierCover || null }, { headers: this.headers() }).subscribe({
      next: d => {
        this.courierBusy = false;
        this.courierFor = null;
        this.updateRow(orderNo, d);
      },
      error: err => { this.courierBusy = false; this.courierError = err?.error?.message || 'Could not book the courier'; }
    });
  }

  printLabel(orderNo: string) {
    this.http.get<{ url: string }>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/courier/label`,
      { headers: this.headers() }).subscribe({
      next: r => window.open(r.url, '_blank'),
      error: err => alert(err?.error?.message || 'Label not available yet - try again in a minute')
    });
  }

  cancelCourier(orderNo: string) {
    if (!confirm(`Cancel the Delhivery shipment for ${orderNo}? Only possible before pickup.`)) return;
    this.http.post<BoutiqueOrderDetail>(`/api/boutique-orders/${encodeURIComponent(orderNo)}/courier/cancel`, {},
      { headers: this.headers() }).subscribe({
      next: d => this.updateRow(orderNo, d),
      error: err => alert(err?.error?.message || 'Could not cancel the shipment')
    });
  }

  private updateRow(orderNo: string, d: BoutiqueOrderDetail) {
    this.details[orderNo] = d;
    const row = this.orders.find(o => o.order_no === orderNo);
    if (row) row.status = d.status;
    if (this.statusFilter === 'DISPATCH' && d.status !== 'PAID') this.orders = this.orders.filter(o => o.order_no !== orderNo);
  }

  sizeLabel(code: string | null): string {
    return code === 'CUSTOM' ? 'Custom (tailor calls)' : (code || '');
  }

  measurementSource(m: { [key: string]: any } | null): string {
    if (!m) return '';
    return m['source'] === 'order_request' ? 'given with the order' : 'from saved profile';
  }

  get filteredOrders(): BoutiqueOrderSummary[] {
    if (!this.searchQuery.trim()) return this.orders;
    const q = this.searchQuery.toLowerCase();
    return this.orders.filter(o =>
      o.order_no.toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').toLowerCase().includes(q) ||
      (o.design_code || '').toLowerCase().includes(q)
    );
  }
}
