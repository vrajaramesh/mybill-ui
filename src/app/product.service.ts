import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductImage } from './product.model';
import { ProductCategory, ProductSubCategory } from './product-category.model';


@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = '/api/products';

  constructor(private http: HttpClient) { }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl);
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  createProduct(product: Product): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  updateProduct(id: number, product: Product): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ── Categories ──────────────────────────────────────────────────────────

  getProductCategories(): Observable<ProductCategory[]> {
    return this.http.get<ProductCategory[]>(`${this.apiUrl}/categories`);
  }

  createProductCategory(categoryName: string): Observable<ProductCategory> {
    return this.http.post<ProductCategory>(`${this.apiUrl}/categories`, { categoryName, isOnline: true });
  }

  updateProductCategory(name: string, isOnline: boolean): Observable<ProductCategory> {
    return this.http.put<ProductCategory>(`${this.apiUrl}/categories/${encodeURIComponent(name)}`, { isOnline });
  }

  deleteProductCategory(name: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categories/${encodeURIComponent(name)}`);
  }

  // ── Sub-categories ──────────────────────────────────────────────────────

  getAllSubCategories(): Observable<ProductSubCategory[]> {
    return this.http.get<ProductSubCategory[]>(`${this.apiUrl}/subcategories`);
  }

  getSubCategories(categoryName: string): Observable<ProductSubCategory[]> {
    return this.http.get<ProductSubCategory[]>(`${this.apiUrl}/categories/${encodeURIComponent(categoryName)}/subcategories`);
  }

  createSubCategory(subCatName: string, categoryName: string): Observable<ProductSubCategory> {
    return this.http.post<ProductSubCategory>(`${this.apiUrl}/subcategories`, {
      subCatName,
      category: { categoryName },
      isOnline: true
    });
  }

  updateSubCategory(id: number, data: Partial<ProductSubCategory>): Observable<ProductSubCategory> {
    return this.http.put<ProductSubCategory>(`${this.apiUrl}/subcategories/${id}`, data);
  }

  deleteSubCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/subcategories/${id}`);
  }

  // ── Images ──────────────────────────────────────────────────────────────

  getProductImages(productId: number): Observable<ProductImage[]> {
    return this.http.get<ProductImage[]>(`${this.apiUrl}/${productId}/images`);
  }

  saveProductImage(productId: number, imageUrl: string, publicId: string, mediaType = 'image'): Observable<ProductImage> {
    return this.http.post<ProductImage>(`${this.apiUrl}/${productId}/images`, { imageUrl, publicId, mediaType });
  }

  deleteProductImage(productId: number, imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${productId}/images/${imageId}`);
  }

  reorderProductImages(productId: number, order: { imageId: number; sortOrder: number }[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${productId}/images/reorder`, order);
  }

  // ── AI Photo Generation ─────────────────────────────────────────────────

  generateAIPhotos(productId: number, imageBase64: string, mimeType: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${productId}/ai-photos/generate`, { imageBase64, mimeType }, { observe: 'response' });
  }

  saveAIPhotos(productId: number, imageUrls: string[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiUrl}/${productId}/ai-photos/save`, imageUrls);
  }

  generateDescription(productName: string, category?: string, suitableFor?: string, tags?: string, imageUrl?: string): Observable<{ description: string }> {
    return this.http.post<{ description: string }>(`${this.apiUrl}/generate-description`, {
      productName, category, suitableFor, tags, imageUrl
    });
  }

  uploadToCloudinary(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post('/api/upload/image', formData);
  }
}
