import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly base = '/api/reports';

  constructor(private http: HttpClient) {}

  getOverview(year: number): Observable<any> {
    return this.http.get(`${this.base}/overview?year=${year}`);
  }

  getMonthlySales(year: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/monthly-sales?year=${year}`);
  }

  getTopProducts(year: number, limit = 10): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/top-products?year=${year}&limit=${limit}`);
  }

  getCategoryRevenue(year: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/category-revenue?year=${year}`);
  }

  getTopCustomers(year: number, limit = 10): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/top-customers?year=${year}&limit=${limit}`);
  }

  getPaymentMethods(year: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/payment-methods?year=${year}`);
  }

  getPurchasesVsSales(year: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/purchases-vs-sales?year=${year}`);
  }

  getCustomerSales(period: 'today' | 'week' | 'month' | 'year'): Observable<any> {
    return this.http.get<any>(`${this.base}/customer-sales?period=${period}`);
  }

  getLowStock(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/low-stock`);
  }
}
