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
  order_type?: string;                 // GARMENT | FABRIC
  fabric_metres?: number | null;
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

export interface BoutiqueOrderDetail {
  order_no: string;
  status: string;
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
  }[];
  subtotal: number;
  delivery_charge: number;
  total: number;
  currency: string;
  estimated_delivery_date: string | null;
  paid_at: string | null;
  payment: BoutiqueOrderPayment | null;
  source_type: string | null;
  source_id: string | null;
  measurement_status: string | null;
  measurement_taken_at: string | null;
  measurement_taken_by: string | null;
  created_at: string;
}

type StatusFilter = 'ALL' | 'MEASURE' | 'DRAFT' | 'PAYMENT_PENDING' | 'PAID' | 'IN_STITCHING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

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

  readonly statuses: StatusFilter[] = ['ALL', 'MEASURE', 'DRAFT', 'PAYMENT_PENDING', 'PAID', 'IN_STITCHING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
  readonly statusLabel: { [s: string]: string } = {
    'MEASURE':      '📏 Measurements pending',
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
      next: d => { this.details[orderNo] = d; this.loadingDetail = null; },
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
