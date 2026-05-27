import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FirmRegistration {
  firmName: string;
  firmCode: string;
  ownerEmail: string;
  adminUsername: string;
  adminPassword: string;
  adminFullName: string;
}

export interface FirmResponse {
  firmId: number;
  firmName: string;
  firmCode: string;
  message: string;
}

export interface Firm {
  firmId: number;
  firmName: string;
  firmCode: string;
  schemaName: string;
  ownerEmail: string;
  isActive: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirmService {
  private apiUrl = '/api/firms';

  constructor(private http: HttpClient) { }

  registerFirm(data: FirmRegistration): Observable<FirmResponse> {
    return this.http.post<FirmResponse>(`${this.apiUrl}/register`, data);
  }

  listFirms(): Observable<Firm[]> {
    return this.http.get<Firm[]>(this.apiUrl);
  }
}

