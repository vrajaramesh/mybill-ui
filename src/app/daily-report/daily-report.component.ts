import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

/** One day's AI report from srisa-agent (GET /api/boutique-reports/{date}). */
export interface DailyReport {
  date: string;
  metrics: any;
  analysis: {
    headline: string; summary: string;
    sentiment: { positive: number; neutral: number; negative: number };
    top_questions: { topic: string; count: number; example: string }[];
    objections: { reason: string; count: number; example: string }[];
    design_feedback: { design: string; feedback: string }[];
    unmet_demand: { request: string; count: number }[];
    ai_issues: { issue: string; example: string; fix: string }[];
    recommendations: { area: string; priority: string; action: string; why: string }[];
    follow_up: { customer: string; chat_id: string; reason: string }[];
  } | null;
  error: string | null;
  chats_analysed: number;
  created_at: string;
}

@Component({
  selector: 'app-daily-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './daily-report.component.html',
  styleUrl: './daily-report.component.css'
})
export class DailyReportComponent implements OnInit {
  days: { date: string; headline: string | null; chats: number | null; error: string | null }[] = [];
  date = this.todayIst();
  report: DailyReport | null = null;
  loading = false;
  generating = false;
  notFound = false;
  error = '';

  readonly areaIcons: { [a: string]: string } = {
    instagram: '📸', whatsapp: '💬', website: '🌐', catalog: '👗', pricing: '💰', operations: '⚙️'
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadDays();
    this.open(this.date);
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('mybill_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private todayIst(): string {
    return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  }

  loadDays() {
    this.http.get<any[]>('/api/boutique-reports', { headers: this.headers() }).subscribe({
      next: d => this.days = d, error: () => {}
    });
  }

  open(date: string) {
    this.date = date;
    this.report = null;
    this.notFound = false;
    this.error = '';
    this.loading = true;
    this.http.get<DailyReport>(`/api/boutique-reports/${date}`, { headers: this.headers() }).subscribe({
      next: r => { if (this.date === date) { this.report = r; this.loading = false; } },
      error: err => {
        if (this.date !== date) return;
        this.loading = false;
        if (err.status === 404) this.notFound = true;
        else this.error = err?.error?.message || 'Could not load the report';
      }
    });
  }

  generate() {
    if (this.generating) return;
    const date = this.date;
    this.generating = true;
    this.error = '';
    this.http.post<DailyReport>(`/api/boutique-reports/${date}/generate`, {}, { headers: this.headers() }).subscribe({
      next: r => { this.generating = false; if (this.date === date) { this.report = r; this.notFound = false; } this.loadDays(); },
      error: err => { this.generating = false; this.error = err?.error?.message || 'Could not generate the report. Please try again.'; }
    });
  }

  chatLink(id: string): string {
    return `${window.location.pathname}?chat=${id}`;
  }

  rupees(v: any): string {
    const n = Number(v || 0);
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  get m(): any { return this.report?.metrics || {}; }
  get sales(): any { return this.m.sales || {}; }
}
