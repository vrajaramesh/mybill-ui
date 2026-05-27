import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bill } from './bill.model';
import { Customer } from './customer.model';
import { Product } from './product.model';
import { GstReportRow } from './gst-report/gst-report.component';

@Injectable({
  providedIn: 'root'
})
export class BillService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  // Bills
  getBills(): Observable<Bill[]> {
    return this.http.get<Bill[]>(`${this.apiUrl}/bills`);
  }

  getBill(id: number): Observable<Bill> {
    return this.http.get<Bill>(`${this.apiUrl}/bills/${id}`);
  }

  createBill(bill: Bill): Observable<Bill> {
    return this.http.post<Bill>(`${this.apiUrl}/bills`, bill);
  }

  updateBill(id: number, bill: Bill): Observable<Bill> {
    return this.http.put<Bill>(`${this.apiUrl}/bills/${id}`, bill);
  }

  deleteBill(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/bills/${id}`);
  }

  // Customers
  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.apiUrl}/customers`);
  }

  createCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(`${this.apiUrl}/customers`, customer);
  }

  // Products
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products`);
  }

  createProduct(product: Product): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/products`, product);
  }

  getProductCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/products/categories`);
  }

  getGstReport(year: number): Observable<GstReportRow[]> {
    return this.http.get<GstReportRow[]>(`${this.apiUrl}/bills/gst-report?year=${year}`);
  }
}