import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'SALES';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
  firms?: { firm_id: number; firm_name: string; firm_code: string; is_active: boolean }[];
}

export interface SalesPerson {
  userId: number;
  username: string;
  fullName: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl      = '/api/users';
  private readonly adminApiUrl = '/api/admin';

  constructor(private http: HttpClient) {}

  // ── Legacy /api/users — used by ADMIN for their own firm ──────────────────

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  createUser(user: Partial<User> & { password: string }): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  updateUser(id: number, user: Partial<User> & { password?: string }): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ── Admin management endpoints ────────────────────────────────────────────

  getAccessibleFirms(): Observable<any[]> {
    return this.http.get<any[]>(`${this.adminApiUrl}/firms`);
  }

  /** Get SALES users for a firm. Pass firmCode for SUPERADMIN, omit for ADMIN. */
  getSalesUsers(firmCode?: string): Observable<any[]> {
    let params = new HttpParams();
    if (firmCode) params = params.set('firmCode', firmCode);
    return this.http.get<any[]>(`${this.adminApiUrl}/users`, { params });
  }

  createSalesUser(payload: {
    firmCode: string; username: string; password: string;
    fullName: string; email?: string; phone?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.adminApiUrl}/users/sales`, payload);
  }

  updateSalesUser(userId: number, payload: any, firmCode?: string): Observable<any> {
    let params = new HttpParams();
    if (firmCode) params = params.set('firmCode', firmCode);
    return this.http.put<any>(`${this.adminApiUrl}/users/sales/${userId}`, payload, { params });
  }

  toggleSalesUserStatus(userId: number, isActive: boolean, firmCode?: string): Observable<any> {
    let params = new HttpParams();
    if (firmCode) params = params.set('firmCode', firmCode);
    return this.http.patch<any>(`${this.adminApiUrl}/users/sales/${userId}/status`, { isActive }, { params });
  }

  // ── Ecom user management ─────────────────────────────────────────────────

  getEcomUsers(firmCode: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.adminApiUrl}/users/ecom`, { params: { firmCode } });
  }

  createEcomUser(payload: {
    firmCode: string; username: string; password: string;
    fullName: string; email?: string; phone?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.adminApiUrl}/users/ecom`, payload);
  }

  toggleEcomUserStatus(userId: number, isActive: boolean, firmCode: string): Observable<any> {
    return this.http.patch<any>(`${this.adminApiUrl}/users/ecom/${userId}/status`, { isActive }, { params: { firmCode } });
  }

  // ── Admin user management (SUPERADMIN only) ───────────────────────────────

  getAdmins(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.adminApiUrl}/admins`);
  }

  createAdmin(payload: {
    username: string; password: string; fullName: string;
    email?: string; phone?: string; firmCodes?: string[];
  }): Observable<any> {
    return this.http.post<any>(`${this.adminApiUrl}/admins`, payload);
  }

  updateAdmin(adminId: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.adminApiUrl}/admins/${adminId}`, payload);
  }

  assignAdminToFirm(adminId: number, firmId: number): Observable<any> {
    return this.http.post<any>(`${this.adminApiUrl}/admins/${adminId}/firms/${firmId}`, {});
  }

  removeAdminFromFirm(adminId: number, firmId: number): Observable<any> {
    return this.http.delete<any>(`${this.adminApiUrl}/admins/${adminId}/firms/${firmId}`);
  }

  // ── Billing dropdown ──────────────────────────────────────────────────────

  getSalesPersons(): Observable<SalesPerson[]> {
    return this.http.get<SalesPerson[]>(`${this.adminApiUrl}/sales-persons`);
  }
}
