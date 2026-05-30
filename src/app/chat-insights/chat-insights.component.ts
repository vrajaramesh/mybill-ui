import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportService } from '../report.service';

type Period = 'today' | 'week' | 'month' | 'year';

@Component({
  selector: 'app-chat-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-insights.component.html',
  styleUrls: ['./chat-insights.component.css']
})
export class ChatInsightsComponent implements OnInit {

  period: Period = 'month';
  loading = false;
  data: any = {};

  summaryLoading = false;
  summaryData: any = null;
  summaryError = '';

  readonly periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today'      },
    { key: 'week',  label: 'This Week'  },
    { key: 'month', label: 'This Month' },
    { key: 'year',  label: 'This Year'  },
  ];

  constructor(private svc: ReportService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  selectPeriod(p: Period): void {
    this.period = p;
    this.summaryData = null;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.svc.getChatAnalytics(this.period).subscribe({
      next: d => {
        this.data = d;
        this.loading = false;
        this.cdr.detectChanges();
        this.loadSummary(false);
      },
      error: () => { this.loading = false; }
    });
  }

  loadSummary(force: boolean): void {
    this.summaryLoading = true;
    this.summaryError = '';
    this.svc.getChatSummary(this.period, force).subscribe({
      next: d => {
        if (d.error) { this.summaryError = d.error; this.summaryData = null; }
        else          { this.summaryData = d; this.summaryError = ''; }
        this.summaryLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.summaryLoading = false; this.summaryError = 'Failed to load AI insights.'; }
    });
  }

  regenerate(): void { this.loadSummary(true); }

  get summaryActions(): any[]    { return this.summaryData?.actions     ?? []; }
  get summaryGaps(): any[]       { return this.summaryData?.demandGaps  ?? []; }
  get summaryAlerts(): any[]     { return this.summaryData?.stockAlerts ?? []; }

  summaryAge(): string {
    if (!this.summaryData?.generatedAt) return '';
    const diff = Math.floor((Date.now() - new Date(this.summaryData.generatedAt).getTime()) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  }

  trustClass(): string {
    const s = (this.summaryData?.trustScore?.score || '').toLowerCase();
    if (s === 'high') return 'trust-high';
    if (s === 'low')  return 'trust-low';
    return 'trust-medium';
  }

  priorityClass(p: number): string {
    if (p === 1) return 'pri-1';
    if (p === 2) return 'pri-2';
    return 'pri-3';
  }

  get overview(): any       { return this.data.overview          ?? {}; }
  get products(): any[]     { return this.data.topProducts       ?? []; }
  get categories(): any[]   { return this.data.topCategories     ?? []; }
  get unanswered(): any[]   { return this.data.unansweredQueries ?? []; }
  get recent(): any[]       { return this.data.recentQueries     ?? []; }
  get imageSearches(): any[]{ return this.data.imageSearches     ?? []; }

  periodLabel(): string {
    return this.periods.find(p => p.key === this.period)?.label ?? '';
  }

  categoryMax(): number {
    return this.categories.length
      ? Math.max(...this.categories.map((c: any) => Number(c.timesShown))) : 1;
  }

  stockBadge(stockQty: any): string {
    const qty = Number(stockQty);
    if (qty < 0) return '';
    if (qty === 0) return 'Out of Stock';
    if (qty < 5) return 'Low Stock';
    return 'In Stock';
  }

  stockClass(stockQty: any): string {
    const qty = Number(stockQty);
    if (qty < 0) return '';
    if (qty === 0) return 'stock-out';
    if (qty < 5) return 'stock-low';
    return 'stock-in';
  }

  thumbUrl(url: string): string {
    if (!url) return '';
    return url.replace('/upload/', '/upload/c_fill,h_120,w_120,q_80/');
  }

  relTime(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
}
