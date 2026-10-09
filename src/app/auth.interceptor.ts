import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    const isExternal = req.url.startsWith('http://') || req.url.startsWith('https://');
    if (token && !isExternal) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }
    return next.handle(req).pipe(
      catchError((err: unknown) => {
        // Session expired / revoked: go back to the login screen instead of showing empty lists.
        if (err instanceof HttpErrorResponse && err.status === 401 && token && !isExternal
            && !req.url.includes('/api/auth/') && this.authService.getToken() === token) {
          this.authService.logout();
          window.location.reload();
        }
        return throwError(() => err);
      })
    );
  }
}
