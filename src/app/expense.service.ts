import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Expense {
  expenseId?: number;
  expenseDate: string;
  category: string;
  description?: string;
  amount: number;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private base = '/api/expenses';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Expense[]> {
    return this.http.get<Expense[]>(this.base);
  }

  getByDateRange(from: string, to: string): Observable<Expense[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<Expense[]>(this.base, { params });
  }

  getSummary(from: string, to: string): Observable<any> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get(`${this.base}/summary`, { params });
  }

  create(e: Expense): Observable<Expense> {
    return this.http.post<Expense>(this.base, e);
  }

  update(id: number, e: Expense): Observable<Expense> {
    return this.http.put<Expense>(`${this.base}/${id}`, e);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
