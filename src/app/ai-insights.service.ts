import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AiInsightsService {
  private base = '/api/business-intelligence';

  constructor(private http: HttpClient) {}

  startReport(extraInput: any): Observable<any> {
    return this.http.post(`${this.base}/report`, extraInput);
  }

  getReport(reportId: number): Observable<any> {
    return this.http.get(`${this.base}/report/${reportId}`);
  }

  getLatestReport(): Observable<any> {
    return this.http.get(`${this.base}/report/latest`);
  }

  getTrends(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/trends`);
  }
}
