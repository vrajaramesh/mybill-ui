import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ReportService } from '../report.service';
import { AuthService } from '../auth.service';

Chart.register(...registerables);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CHART_COLORS = ['#2563eb','#2d6a4f','#d97706','#dc2626','#7c3aed','#0891b2','#059669','#9333ea'];

type Period = 'today' | 'week' | 'month' | 'year';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit, OnDestroy {

  // ── Year-based analytics ──────────────────────────────
  selectedYear = new Date().getFullYear();
  years: number[] = [];
  loading = false;
  error = '';

  overview: any = {};
  monthlySales: any[] = [];
  topProducts: any[] = [];
  categoryRevenue: any[] = [];
  topCustomers: any[] = [];
  paymentMethods: any[] = [];
  purchasesVsSales: any[] = [];
  lowStock: any[] = [];

  // ── Customer Sales by Period ──────────────────────────
  csPeriod: Period = 'month';
  csLoading = false;
  csData: any = { summary: {}, customers: [], from: '', to: '' };

  // ── User Sales by Period ──────────────────────────────
  usPeriod: Period = 'month';
  usLoading = false;
  usData: any = { summary: {}, users: [], from: '', to: '' };


  readonly periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today'      },
    { key: 'week',  label: 'This Week'  },
    { key: 'month', label: 'This Month' },
    { key: 'year',  label: 'This Year'  },
  ];

  private charts: Chart[] = [];

  constructor(private svc: ReportService, private cdr: ChangeDetectorRef, private auth: AuthService) {}

  get isSales(): boolean { return this.auth.isSales(); }

  ngOnInit(): void {
    const cur = new Date().getFullYear();
    for (let y = cur; y >= 2020; y--) this.years.push(y);
    this.loadAll();
    this.loadCustomerSales();
    this.loadUserSales();
  }

  ngOnDestroy(): void { this.destroyCharts(); }

  // ── Year analytics ─────────────────────────────────────
  changeYear(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    this.error = '';
    this.destroyCharts();
    const y = this.selectedYear;

    forkJoin({
      overview:  this.svc.getOverview(y),
      monthly:   this.svc.getMonthlySales(y),
      products:  this.svc.getTopProducts(y),
      cats:      this.svc.getCategoryRevenue(y),
      customers: this.svc.getTopCustomers(y),
      payments:  this.svc.getPaymentMethods(y),
      compare:   this.svc.getPurchasesVsSales(y),
      stock:     this.svc.getLowStock()
    }).subscribe({
      next: d => {
        this.overview         = d.overview;
        this.monthlySales     = d.monthly;
        this.topProducts      = d.products;
        this.categoryRevenue  = d.cats;
        this.topCustomers     = d.customers;
        this.paymentMethods   = d.payments;
        this.purchasesVsSales = d.compare;
        this.lowStock         = d.stock;
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.createCharts(), 60);
      },
      error: () => { this.loading = false; this.error = 'Failed to load report data'; }
    });
  }

  // ── Customer Sales ─────────────────────────────────────
  selectPeriod(p: Period): void {
    this.csPeriod = p;
    this.loadCustomerSales();
  }

  loadCustomerSales(): void {
    this.csLoading = true;
    this.svc.getCustomerSales(this.csPeriod).subscribe({
      next: d => { this.csData = d; this.csLoading = false; this.cdr.detectChanges(); },
      error: () => { this.csLoading = false; }
    });
  }

  get csCustomers(): any[]  { return this.csData.customers ?? []; }
  get csSummary(): any      { return this.csData.summary   ?? {}; }
  get csMax(): number       { return this.csCustomers.length ? Number(this.csCustomers[0].totalSales) : 1; }

  periodLabel(): string {
    return this.periods.find(p => p.key === this.csPeriod)?.label ?? '';
  }

  csDateRange(): string {
    if (!this.csData.from) return '';
    if (this.csPeriod === 'today') return this.formatDate(this.csData.from);
    return `${this.formatDate(this.csData.from)} – ${this.formatDate(this.csData.to)}`;
  }

  private formatDate(d: string): string {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── User Sales ─────────────────────────────────────────
  selectUserPeriod(p: Period): void {
    this.usPeriod = p;
    this.loadUserSales();
  }

  loadUserSales(): void {
    this.usLoading = true;
    this.svc.getUserSales(this.usPeriod).subscribe({
      next: d => { this.usData = d; this.usLoading = false; this.cdr.detectChanges(); },
      error: () => { this.usLoading = false; }
    });
  }

  get usUsers(): any[]  { return this.usData.users   ?? []; }
  get usSummary(): any  { return this.usData.summary  ?? {}; }
  get usMax(): number   { return this.usUsers.length ? Number(this.usUsers[0].totalSales) : 1; }

  userPeriodLabel(): string {
    return this.periods.find(p => p.key === this.usPeriod)?.label ?? '';
  }

  usDateRange(): string {
    if (!this.usData.from) return '';
    if (this.usPeriod === 'today') return this.formatDate(this.usData.from);
    return `${this.formatDate(this.usData.from)} – ${this.formatDate(this.usData.to)}`;
  }

  // ── Shared helpers ─────────────────────────────────────
  fmt(val: any): string {
    const n = Number(val) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  pct(val: any, total: any): string {
    const t = Number(total) || 0;
    if (!t) return '0%';
    return ((Number(val) / t) * 100).toFixed(1) + '%';
  }

  topProductMax(): number {
    return this.topProducts.length ? Math.max(...this.topProducts.map(p => Number(p.revenue))) : 1;
  }

  topCustomerMax(): number {
    return this.topCustomers.length ? Math.max(...this.topCustomers.map(c => Number(c.totalSpend))) : 1;
  }

  totalPaymentAmount(): number {
    return this.paymentMethods.reduce((s, p) => s + Number(p.amount), 0);
  }

  stockStatus(qty: any, min: any): string {
    const q = Number(qty), m = Number(min);
    if (q === 0) return 'Out of Stock';
    if (q < m * 0.5) return 'Critical';
    return 'Low';
  }

  stockClass(qty: any, min: any): string {
    const q = Number(qty), m = Number(min);
    if (q === 0) return 'stock-out';
    if (q < m * 0.5) return 'stock-critical';
    return 'stock-low';
  }

  // ── Charts ─────────────────────────────────────────────
  private destroyCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private createCharts(): void {
    this.createMonthlySalesChart();
    this.createCategoryChart();
    this.createPaymentChart();
    this.createComparisonChart();
  }

  private canvas(id: string): HTMLCanvasElement | null {
    return document.getElementById(id) as HTMLCanvasElement | null;
  }

  private push(c: Chart): void { this.charts.push(c); }

  private createMonthlySalesChart(): void {
    const el = this.canvas('chart-monthly');
    if (!el) return;
    this.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [{
          label: 'Sales (₹)',
          data: MONTHS.map((_, i) => {
            const r = this.monthlySales.find(r => r.month === i + 1);
            return r ? Number(r.totalAmount) : 0;
          }),
          backgroundColor: 'rgba(45,106,79,0.85)',
          borderColor: '#2d6a4f',
          borderWidth: 1,
          borderRadius: 5
        }, {
          label: 'GST (₹)',
          data: MONTHS.map((_, i) => {
            const r = this.monthlySales.find(r => r.month === i + 1);
            return r ? Number(r.gstAmount) : 0;
          }),
          backgroundColor: 'rgba(64,145,108,0.45)',
          borderColor: '#40916c',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: ctx => ` ₹${Number(ctx.raw).toLocaleString('en-IN')}` } }
        },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + Number(v).toLocaleString('en-IN') } } }
      }
    }));
  }

  private createCategoryChart(): void {
    const el = this.canvas('chart-category');
    if (!el || !this.categoryRevenue.length) return;
    this.push(new Chart(el, {
      type: 'doughnut',
      data: {
        labels: this.categoryRevenue.map(r => r.category),
        datasets: [{ data: this.categoryRevenue.map(r => Number(r.revenue)), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}` } }
        }
      }
    }));
  }

  private createPaymentChart(): void {
    const el = this.canvas('chart-payment');
    if (!el || !this.paymentMethods.length) return;
    this.push(new Chart(el, {
      type: 'doughnut',
      data: {
        labels: this.paymentMethods.map(p => p.method),
        datasets: [{ data: this.paymentMethods.map(p => Number(p.amount)), backgroundColor: ['#2d6a4f','#2563eb','#d97706','#dc2626'], borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}` } }
        }
      }
    }));
  }

  private createComparisonChart(): void {
    const el = this.canvas('chart-compare');
    if (!el) return;
    this.push(new Chart(el, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [
          { label: 'Sales',     data: this.purchasesVsSales.map(r => Number(r.sales)),     backgroundColor: 'rgba(45,106,79,0.85)', borderRadius: 4 },
          { label: 'Purchases', data: this.purchasesVsSales.map(r => Number(r.purchases)), backgroundColor: 'rgba(220,38,38,0.75)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: ctx => ` ₹${Number(ctx.raw).toLocaleString('en-IN')}` } }
        },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + Number(v).toLocaleString('en-IN') } } }
      }
    }));
  }
}
