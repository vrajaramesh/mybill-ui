import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = '/api/users';

  constructor(private http: HttpClient) {}

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
}
