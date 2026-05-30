import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface EcomOrder {
  order_id: number;
  amount: number;
  status: string;
  admin_notes: string | null;
  delivery_name: string;
  delivery_phone: string;
  delivery_email: string;
  delivery_address: string;
  delivery_city: string;
  delivery_pincode: string;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  items: EcomOrderItem[];
}

export interface EcomOrderItem {
  id: number;
  product_id: number;
  product_name: string;
  unit: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

type StatusFilter = 'ALL' | 'PAID' | 'PROCESSING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-ecom-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ecom-orders.component.html',
  styleUrl: './ecom-orders.component.css'
})
export class EcomOrdersComponent implements OnInit {
  orders: EcomOrder[] = [];
  loading = false;
  statusFilter: StatusFilter = 'ALL';
  searchQuery = '';

  expandedOrderId: number | null = null;
  updatingOrderId: number | null = null;
  editingNotes: { [orderId: number]: string } = {};

  readonly statuses: StatusFilter[] = ['ALL', 'PAID', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  readonly nextStatus: { [s: string]: string } = {
    'PAID':       'PROCESSING',
    'PROCESSING': 'READY',
    'READY':      'SHIPPED',
    'SHIPPED':    'DELIVERED'
  };
  readonly statusLabel: { [s: string]: string } = {
    'PAID':       'New Order',
    'PROCESSING': 'Processing',
    'READY':      'Ready',
    'SHIPPED':    'Shipped',
    'DELIVERED':  'Delivered',
    'CANCELLED':  'Cancelled'
  };
  readonly statusColor: { [s: string]: string } = {
    'PAID':       '#f59e0b',
    'PROCESSING': '#3b82f6',
    'READY':      '#8b5cf6',
    'SHIPPED':    '#06b6d4',
    'DELIVERED':  '#10b981',
    'CANCELLED':  '#ef4444'
  };

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('mybill_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  load() {
    this.loading = true;
    const params: any = {};
    if (this.statusFilter !== 'ALL') params['status'] = this.statusFilter;
    if (this.searchQuery.trim()) params['search'] = this.searchQuery.trim();

    this.http.get<EcomOrder[]>('/api/ecom-orders', { headers: this.headers(), params }).subscribe({
      next: orders => { this.orders = orders; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  setFilter(s: StatusFilter) {
    this.statusFilter = s;
    this.load();
  }

  toggleExpand(orderId: number) {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
  }

  advanceStatus(order: EcomOrder) {
    const next = this.nextStatus[order.status];
    if (!next) return;
    this.updateStatus(order, next);
  }

  cancelOrder(order: EcomOrder) {
    if (!confirm(`Cancel order #${order.order_id}?`)) return;
    this.updateStatus(order, 'CANCELLED');
  }

  updateStatus(order: EcomOrder, newStatus: string) {
    this.updatingOrderId = order.order_id;
    const body: any = { status: newStatus };
    const notes = this.editingNotes[order.order_id];
    if (notes !== undefined) body.adminNotes = notes;

    this.http.put(`/api/ecom-orders/${order.order_id}/status`, body,
      { headers: this.headers() }).subscribe({
      next: () => {
        order.status = newStatus;
        this.updatingOrderId = null;
        this.load();
      },
      error: () => { this.updatingOrderId = null; }
    });
  }

  saveNotes(order: EcomOrder) {
    const notes = this.editingNotes[order.order_id];
    if (notes === undefined) return;
    this.http.put(`/api/ecom-orders/${order.order_id}/status`,
      { status: order.status, adminNotes: notes },
      { headers: this.headers() }).subscribe({
      next: () => { order.admin_notes = notes; delete this.editingNotes[order.order_id]; },
      error: () => {}
    });
  }

  get filteredOrders(): EcomOrder[] {
    if (!this.searchQuery.trim()) return this.orders;
    const q = this.searchQuery.toLowerCase();
    return this.orders.filter(o =>
      (o.delivery_name || '').toLowerCase().includes(q) ||
      (o.delivery_phone || '').toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q)
    );
  }
}
