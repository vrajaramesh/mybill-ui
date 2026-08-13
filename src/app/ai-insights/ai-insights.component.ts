import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiInsightsService } from '../ai-insights.service';

@Component({
  selector: 'app-ai-insights',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-insights.component.html',
  styleUrl: './ai-insights.component.css'
})
export class AiInsightsComponent implements OnInit {
  loading = false;
  report: any = null;
  errorMsg = '';

  // Extra context form
  businessGoals = '';
  additionalNotes = '';
  targetProducts = '';
  competitorNotes = '';

  constructor(private aiService: AiInsightsService) {}

  ngOnInit(): void {}

  generateReport(): void {
    this.loading = true;
    this.errorMsg = '';
    this.report = null;

    const extraInput: any = {};
    if (this.businessGoals.trim()) extraInput['business_goals'] = this.businessGoals.trim();
    if (this.targetProducts.trim()) extraInput['target_products'] = this.targetProducts.trim();
    if (this.competitorNotes.trim()) extraInput['competitor_notes'] = this.competitorNotes.trim();
    if (this.additionalNotes.trim()) extraInput['additional_notes'] = this.additionalNotes.trim();

    this.aiService.generateReport(extraInput).subscribe({
      next: data => {
        this.report = data;
        this.loading = false;
      },
      error: err => {
        this.errorMsg = err?.error?.message || 'Failed to generate report. Please try again.';
        this.loading = false;
      }
    });
  }

  get salesSummary(): any {
    return this.report?.salesSummary || {};
  }

  get expenseSummary(): any {
    return this.report?.expenseSummary || {};
  }

  get topProducts(): any[] {
    return this.report?.topProducts || [];
  }

  get deadStock(): any[] {
    return this.report?.deadStock || [];
  }

  get trendingFabrics(): any[] {
    return this.report?.trendingFabrics || [];
  }

  get aiReport(): string {
    return this.report?.aiReport || '';
  }

  get generatedAt(): string {
    return this.report?.generatedAt || '';
  }

  get netRevenue(): number {
    const rev = parseFloat(this.salesSummary['total_revenue']) || 0;
    return rev;
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
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
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
