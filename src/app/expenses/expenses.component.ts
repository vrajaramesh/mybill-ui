import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService, Expense } from '../expense.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.css'
})
export class ExpensesComponent implements OnInit {
  expenses: Expense[] = [];
  summary: any = {};
  showForm = false;
  editingId: number | null = null;
  saving = false;
  loading = false;
  errorMsg = '';

  categories = ['SALARY', 'RENT', 'MARKETING', 'TRANSPORT', 'UTILITIES', 'OTHER'];

  form: Expense = {
    expenseDate: new Date().toISOString().slice(0, 10),
    category: 'OTHER',
    description: '',
    amount: 0
  };

  // Date filter
  fromDate: string = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();
  toDate: string = new Date().toISOString().slice(0, 10);

  // Summary period (current month)
  summaryFrom: string = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  summaryTo: string = new Date().toISOString().slice(0, 10);

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.loadAll();
    this.loadSummary();
  }

  loadAll(): void {
    this.loading = true;
    this.expenseService.getAll().subscribe({
      next: data => { this.expenses = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadFiltered(): void {
    this.loading = true;
    this.expenseService.getByDateRange(this.fromDate, this.toDate).subscribe({
      next: data => { this.expenses = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadSummary(): void {
    this.expenseService.getSummary(this.summaryFrom, this.summaryTo).subscribe({
      next: data => { this.summary = data; },
      error: () => {}
    });
  }

  get summaryCategories(): string[] {
    return Object.keys(this.summary).filter(k => k !== 'TOTAL');
  }

  get summaryTotal(): number {
    return this.summary['TOTAL'] || 0;
  }

  openAdd(): void {
    this.editingId = null;
    this.form = {
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'OTHER',
      description: '',
      amount: 0
    };
    this.showForm = true;
    this.errorMsg = '';
  }

  editExpense(expense: Expense): void {
    this.editingId = expense.expenseId!;
    this.form = {
      expenseDate: expense.expenseDate,
      category: expense.category,
      description: expense.description || '',
      amount: expense.amount
    };
    this.showForm = true;
    this.errorMsg = '';
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.errorMsg = '';
  }

  saveExpense(): void {
    if (!this.form.expenseDate || !this.form.category || !this.form.amount) {
      this.errorMsg = 'Date, category and amount are required.';
      return;
    }
    this.saving = true;
    this.errorMsg = '';

    const obs = this.editingId
      ? this.expenseService.update(this.editingId, this.form)
      : this.expenseService.create(this.form);

    obs.subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.editingId = null;
        this.loadAll();
        this.loadSummary();
      },
      error: err => {
        this.saving = false;
        this.errorMsg = err?.error?.message || 'Failed to save expense.';
      }
    });
  }

  deleteExpense(id: number): void {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    this.expenseService.delete(id).subscribe({
      next: () => {
        this.expenses = this.expenses.filter(e => e.expenseId !== id);
        this.loadSummary();
      },
      error: () => alert('Failed to delete expense.')
    });
  }

  formatAmount(amt: any): string {
    const n = parseFloat(amt);
    return isNaN(n) ? '0' : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  categoryColor(category: string): string {
    const colors: any = {
      SALARY: '#4a90d9',
      RENT: '#e67e22',
      MARKETING: '#9b59b6',
      TRANSPORT: '#27ae60',
      UTILITIES: '#e74c3c',
      OTHER: '#7f8c8d'
    };
    return colors[category] || '#7f8c8d';
  }
}
