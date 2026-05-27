import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface CurrentUser {
  userId: number;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'SALES' | 'SUPERADMIN';
  email?: string;
  phone?: string;
  firmId?: number;
  firmName?: string;
  isSuperadmin?: boolean;
  accessLevel?: string;
}

export interface FirmAccessInfo {
  firmId: number;
  firmName: string;
  firmCode: string;
  accessLevel: string;
  isPrimary: boolean;
}

export interface LoginResponse {
  token?: string;
  userId?: number;
  username: string;
  fullName?: string;
  role?: string;
  email?: string;
  phone?: string;
  firmId?: number;
  firmName?: string;
  firmCode?: string;
  isSuperadmin?: boolean;
  accessLevel?: string;
  requiresFirmSelection?: boolean;
  availableFirms?: FirmAccessInfo[];
}

const TOKEN_KEY = 'mybill_token';
const USER_KEY  = 'mybill_user';
const FIRMS_KEY = 'mybill_available_firms';
const CURRENT_FIRM_KEY = 'mybill_current_firm';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/api/auth';

  constructor(private http: HttpClient) {}

  /**
   * Login without firm code - will detect superadmin or multi-firm access
   */
  login(username: string, password: string, firmCode: string = ''): Observable<LoginResponse> {
    const payload: any = { username, password };
    if (firmCode && firmCode.trim()) {
      payload.firmCode = firmCode.trim();
    }

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, payload).pipe(
      tap(resp => {
        // Handle superadmin login
        if (resp.isSuperadmin) {
          localStorage.setItem(TOKEN_KEY, resp.token!);
          localStorage.setItem(USER_KEY, JSON.stringify({
            userId: resp.userId,
            username: resp.username,
            fullName: resp.fullName || '',
            role: 'SUPERADMIN',
            email: resp.email || '',
            phone: resp.phone || '',
            isSuperadmin: true
          }));
          return;
        }

        // Handle normal firm login
        if (resp.token && !resp.requiresFirmSelection) {
          localStorage.setItem(TOKEN_KEY, resp.token);
          localStorage.setItem(USER_KEY, JSON.stringify({
            userId: resp.userId,
            username: resp.username,
            fullName: resp.fullName,
            role: resp.role,
            email: resp.email,
            phone: resp.phone,
            firmId: resp.firmId,
            firmName: resp.firmName,
            accessLevel: resp.accessLevel
          }));
          localStorage.setItem(CURRENT_FIRM_KEY, JSON.stringify({
            firmId: resp.firmId,
            firmName: resp.firmName,
            firmCode: resp.firmCode
          }));
        }

        // Handle multi-firm selection response
        if (resp.requiresFirmSelection && resp.availableFirms) {
          localStorage.setItem(FIRMS_KEY, JSON.stringify(resp.availableFirms));
          localStorage.setItem(USER_KEY, JSON.stringify({
            userId: resp.userId || 0,
            username: resp.username,
            fullName: resp.fullName || '',
            role: resp.role || 'ADMIN',
            email: resp.email || '',
            phone: resp.phone || ''
          }));
        }
      })
    );
  }

  /**
   * Login to a specific firm after firm selection
   */
  loginWithFirm(username: string, password: string, firmCode: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/login-with-firm`,
      { username, password, firmCode }
    ).pipe(
      tap(resp => {
        if (resp.token) {
          localStorage.setItem(TOKEN_KEY, resp.token);
          localStorage.setItem(USER_KEY, JSON.stringify({
            userId: resp.userId,
            username: resp.username,
            fullName: resp.fullName,
            role: resp.role,
            email: resp.email,
            phone: resp.phone,
            firmId: resp.firmId,
            firmName: resp.firmName,
            accessLevel: resp.accessLevel
          }));
          localStorage.setItem(CURRENT_FIRM_KEY, JSON.stringify({
            firmId: resp.firmId,
            firmName: resp.firmName,
            firmCode: resp.firmCode
          }));
        }
      })
    );
  }

  /**
   * Get available firms for multi-firm selection
   */
  getAvailableFirms(): FirmAccessInfo[] {
    const raw = localStorage.getItem(FIRMS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  /**
   * Clear multi-firm data
   */
  clearFirmSelection(): void {
    localStorage.removeItem(FIRMS_KEY);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(FIRMS_KEY);
    localStorage.removeItem(CURRENT_FIRM_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getCurrentUser(): CurrentUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  getCurrentFirm(): any {
    const raw = localStorage.getItem(CURRENT_FIRM_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }

  isSuperadmin(): boolean {
    return this.getCurrentUser()?.isSuperadmin === true;
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'ADMIN';
  }

  isSales(): boolean {
    return this.getCurrentUser()?.role === 'SALES';
  }

  canEditProducts(): boolean { return this.isAdmin(); }
  canDeleteBills(): boolean { return this.isAdmin(); }
  canManageUsers(): boolean { return this.isAdmin(); }
}
