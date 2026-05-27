import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillService } from '../bill.service';

export interface GstReportRow {
  year: number;
  month: number;
  monthName: string;
  startingBillNumber: string;
  endingBillNumber: string;
  totalBills: number;
  totalTaxableAmount: number;
  totalGstAmount: number;
  sgst: number;
  cgst: number;
}

@Component({
  selector: 'app-gst-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gst-report.component.html',
  styleUrls: ['./gst-report.component.css']
})
export class GstReportComponent implements OnInit {
  selectedYear: number = new Date().getFullYear();
  years: number[] = [];
  rows: GstReportRow[] = [];
  loading = false;
  error = '';

  constructor(private billService: BillService) {}

  ngOnInit(): void {
    const current = new Date().getFullYear();
    for (let y = current; y >= current - 5; y--) {
      this.years.push(y);
    }
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.error = '';
    this.billService.getGstReport(this.selectedYear).subscribe({
      next: (data) => {
        this.rows = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load GST report.';
        this.loading = false;
      }
    });
  }

  get totalBillsSum(): number {
    return this.rows.reduce((s, r) => s + Number(r.totalBills), 0);
  }
  get totalTaxable(): number {
    return this.rows.reduce((s, r) => s + Number(r.totalTaxableAmount), 0);
  }
  get totalGst(): number {
    return this.rows.reduce((s, r) => s + Number(r.totalGstAmount), 0);
  }
  get totalSgst(): number {
    return this.rows.reduce((s, r) => s + Number(r.sgst), 0);
  }
  get totalCgst(): number {
    return this.rows.reduce((s, r) => s + Number(r.cgst), 0);
  }
}