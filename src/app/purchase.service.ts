import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Purchase, PurchaseItem, PurchasePayment } from './purchase.model';
import { Supplier } from './supplier.model';
import { Product } from './product.model';

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) { }

  // Supplier endpoints
  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(`${this.apiUrl}/suppliers`);
  }

  getSupplier(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.apiUrl}/suppliers/${id}`);
  }

  createSupplier(supplier: Supplier): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.apiUrl}/suppliers`, supplier);
  }

  updateSupplier(id: number, supplier: Supplier): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.apiUrl}/suppliers/${id}`, supplier);
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/suppliers/${id}`);
  }

  // Product endpoints (for purchase items)
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products`);
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${id}`);
  }

  createProduct(product: Product): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/products`, product);
  }

  getProductCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/products/categories`);
  }

  // Purchase endpoints
  getPurchases(): Observable<Purchase[]> {
    return this.http.get<Purchase[]>(`${this.apiUrl}/purchases`);
  }

  getPurchase(id: number): Observable<Purchase> {
    return this.http.get<Purchase>(`${this.apiUrl}/purchases/${id}`);
  }

  createPurchase(purchase: Purchase): Observable<Purchase> {
    return this.http.post<Purchase>(`${this.apiUrl}/purchases`, purchase);
  }

  updatePurchase(id: number, purchase: Purchase): Observable<Purchase> {
    return this.http.put<Purchase>(`${this.apiUrl}/purchases/${id}`, purchase);
  }

  deletePurchase(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/purchases/${id}`);
  }

  getPurchasesBySupplier(supplierId: number): Observable<Purchase[]> {
    return this.http.get<Purchase[]>(`${this.apiUrl}/purchases/supplier/${supplierId}`);
  }

  getPurchasesByStatus(status: string): Observable<Purchase[]> {
    return this.http.get<Purchase[]>(`${this.apiUrl}/purchases/status/${status}`);
  }

  // Purchase Items endpoints
  getPurchaseItems(purchaseId: number): Observable<PurchaseItem[]> {
    return this.http.get<PurchaseItem[]>(`${this.apiUrl}/purchases/${purchaseId}/items`);
  }

  addPurchaseItem(purchaseId: number, item: PurchaseItem): Observable<PurchaseItem> {
    return this.http.post<PurchaseItem>(`${this.apiUrl}/purchases/${purchaseId}/items`, item);
  }

  // Purchase Payments endpoints
  getPurchasePayments(purchaseId: number): Observable<PurchasePayment[]> {
    return this.http.get<PurchasePayment[]>(`${this.apiUrl}/purchases/${purchaseId}/payments`);
  }

  addPurchasePayment(purchaseId: number, payment: PurchasePayment): Observable<PurchasePayment> {
    return this.http.post<PurchasePayment>(`${this.apiUrl}/purchases/${purchaseId}/payments`, payment);
  }
}
