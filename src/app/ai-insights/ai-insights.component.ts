import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { AiInsightsService } from '../ai-insights.service';

@Component({
  selector: 'app-ai-insights',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-insights.component.html',
  styleUrl: './ai-insights.component.css'
})
export class AiInsightsComponent implements OnInit, OnDestroy {
  loading = false;
  report: any = null;
  errorMsg = '';
  statusMsg = '';
  reportId: number | null = null;
  private pollSub?: Subscription;

  // Extra context form
  businessGoals = '';
  additionalNotes = '';
  targetProducts = '';
  competitorNotes = '';

  constructor(private aiService: AiInsightsService) {}

  ngOnInit(): void {
    // Load latest cached report so the user sees previous results immediately
    this.aiService.getLatestReport().subscribe({
      next: data => {
        if (data.status === 'DONE') {
          this.report = data;
        } else if (data.status === 'PENDING' || data.status === 'PROCESSING') {
          // A report was already in progress — resume polling it
          this.reportId = data.reportId;
          this.loading = true;
          this.statusMsg = 'A report is already being generated...';
          this.startPolling(data.reportId);
        }
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  generateReport(): void {
    this.pollSub?.unsubscribe();
    this.loading = true;
    this.errorMsg = '';
    this.statusMsg = 'Starting report generation...';

    const extraInput: any = {};
    if (this.businessGoals.trim())    extraInput['business_goals']    = this.businessGoals.trim();
    if (this.targetProducts.trim())   extraInput['target_products']   = this.targetProducts.trim();
    if (this.competitorNotes.trim())  extraInput['competitor_notes']  = this.competitorNotes.trim();
    if (this.additionalNotes.trim())  extraInput['additional_notes']  = this.additionalNotes.trim();

    this.aiService.startReport(extraInput).subscribe({
      next: data => {
        this.reportId = data.reportId;
        this.statusMsg = 'Report queued — analysing sales, inventory, expenses and market trends...';
        this.startPolling(data.reportId);
      },
      error: err => {
        this.errorMsg = err?.error?.message || 'Failed to start report. Please try again.';
        this.loading = false;
        this.statusMsg = '';
      }
    });
  }

  private startPolling(reportId: number): void {
    let elapsed = 0;
    this.pollSub = interval(5000).pipe(
      switchMap(() => this.aiService.getReport(reportId)),
      takeWhile(r => r.status !== 'DONE' && r.status !== 'FAILED', true)
    ).subscribe({
      next: data => {
        elapsed += 5;
        if (data.status === 'DONE') {
          this.report = data;
          this.loading = false;
          this.statusMsg = '';
        } else if (data.status === 'FAILED') {
          this.errorMsg = data.errorMsg || 'Report generation failed. Please try again.';
          this.loading = false;
          this.statusMsg = '';
        } else {
          const mins = Math.floor(elapsed / 60);
          const secs = elapsed % 60;
          const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          this.statusMsg = `AI is analysing your business data... (${timeStr} elapsed, usually takes 60–90s)`;
        }
      },
      error: () => {
        this.errorMsg = 'Lost connection while waiting for report. Please refresh and try again.';
        this.loading = false;
        this.statusMsg = '';
      }
    });
  }

  get salesSummary(): any    { return this.report?.salesSummary || {}; }
  get expenseSummary(): any  { return this.report?.expenseSummary || {}; }
  get topProducts(): any[]   { return this.report?.topProducts || []; }
  get deadStock(): any[]     { return this.report?.deadStock || []; }
  get trendingFabrics(): any[] { return this.report?.trendingFabrics || []; }
  get trendImages(): any[]     { return this.report?.trendImages || []; }
  get aiReport(): string     { return this.report?.aiReport || ''; }
  get generatedAt(): string  { return this.report?.generatedAt || ''; }

  get netRevenue(): number {
    return parseFloat(this.salesSummary['total_revenue']) || 0;
  }

  get totalExpenses(): number {
    const t = this.expenseSummary['TOTAL'];
    return t ? parseFloat(t) : 0;
  }

  get totalBills(): number {
    return parseInt(this.salesSummary['total_bills']) || 0;
  }

  get uniqueCustomers(): number {
    return parseInt(this.salesSummary['unique_customers']) || 0;
  }

  get netProfit(): number {
    const purchaseTotal = parseFloat(this.report?.purchaseSummary?.['total_amount']) || 0;
    return this.netRevenue - this.totalExpenses - purchaseTotal;
  }

  formatAmount(val: any): string {
    const n = parseFloat(val);
    return isNaN(n) ? '0' : n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  renderMarkdown(text: string): string {
    if (!text) return '';
    return text
      .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/^- (.+)$/gm,   '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
      .replace(/---/g, '<hr>')
      .replace(/<p><\/p>/g, '');
  }

  hasTrendNote(): boolean {
    return this.trendingFabrics.length === 1 && !!this.trendingFabrics[0]['note'];
  }
}
