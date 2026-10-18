import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

/** GET /api/boutique-marketing/report row: one marketing link, "Unmapped/other" (link_id null) or the total. */
export interface AdReportRow {
  link_id: number | null;
  source_type: string | null;
  source_id: string | null;
  design_code: string | null;
  label: string;
  active: boolean | null;
  conversations: number;
  orders: number;
  paid_orders: number;
  paid_revenue: number;
  conversion_pct: number | null;
}

export interface AdReport { from: string; to: string; rows: AdReportRow[]; total: AdReportRow; }

@Component({
  selector: 'app-ad-performance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-performance.component.html',
  styleUrl: './ad-performance.component.css'
})
export class AdPerformanceComponent implements OnInit {
  report: AdReport | null = null;
  loading = false;
  error = '';
  from = '';
  to = '';

  readonly presets = [
    { label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() { this.applyPreset(30); }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('mybill_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  /** Local calendar date as yyyy-MM-dd (the server reads report dates as IST days). */
  private iso(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  applyPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    this.from = this.iso(start);
    this.to = this.iso(end);
    this.load();
  }

  load() {
    if (this.from && this.to && this.from > this.to) { this.error = '"From" must be on or before "To".'; return; }
    this.loading = true;
    this.error = '';
    const params: any = {};
    if (this.from) params['from'] = this.from;
    if (this.to) params['to'] = this.to;
    this.http.get<AdReport>('/api/boutique-marketing/report', { headers: this.headers(), params }).subscribe({
      next: r => { this.report = r; this.loading = false; },
      error: err => { this.loading = false; this.error = err?.error?.message || 'Could not load the report'; }
    });
  }

  sourceLabel(r: AdReportRow): string {
    if (!r.source_type) return '';
    return (r.source_type === 'AD' ? 'Ad ' : 'IG post ') + r.source_id;
  }
}
