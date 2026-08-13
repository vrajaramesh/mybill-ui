import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AiInsightsService {
  private base = '/api/business-intelligence';

  constructor(private http: HttpClient) {}

  generateReport(extraInput: any): Observable<any> {
    return this.http.post(`${this.base}/report`, extraInput);
  }

  getTrends(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/trends`);
  }
}
