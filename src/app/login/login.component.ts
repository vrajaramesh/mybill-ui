import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, LoginResponse, FirmAccessInfo } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  @Output() loginSuccess = new EventEmitter<void>();
  @Output() registerFirm = new EventEmitter<void>();
  @Output() firmSelectionRequired = new EventEmitter<FirmAccessInfo[]>();

  firmCode = '';
  username = '';
  password = '';
  error = '';
  loading = false;
  showFirmSelection = false;
  availableFirms: FirmAccessInfo[] = [];

  constructor(private authService: AuthService) {}

  onSubmit(): void {
    if (!this.username.trim() || !this.password) return;
    this.loading = true;
    this.error = '';

    // Login without firm code - let backend determine if multi-firm or superadmin
    this.authService.login(this.username.trim(), this.password).subscribe({
      next: (resp: LoginResponse) => {
        this.loading = false;

        // Handle superadmin login
        if (resp.isSuperadmin) {
          this.loginSuccess.emit();
          return;
        }

        // Handle multi-firm selection required
        if (resp.requiresFirmSelection && resp.availableFirms && resp.availableFirms.length > 0) {
          this.availableFirms = resp.availableFirms;
          this.showFirmSelection = true;
          this.firmSelectionRequired.emit(resp.availableFirms);
          return;
        }

        // Handle normal single-firm login
        if (resp.token) {
          this.loginSuccess.emit();
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Invalid credentials';
      }
    });
  }

  onSelectFirm(firmCode: string): void {
    if (!firmCode || !this.username.trim() || !this.password) return;
    this.loading = true;
    this.error = '';

    // Login to selected firm
    this.authService.loginWithFirm(this.username.trim(), this.password, firmCode).subscribe({
      next: () => {
        this.loading = false;
        this.showFirmSelection = false;
        this.authService.clearFirmSelection();
        this.loginSuccess.emit();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Failed to login to firm';
      }
    });
  }

  onBackFromFirmSelection(): void {
    this.showFirmSelection = false;
    this.username = '';
    this.password = '';
    this.error = '';
  }

  onRegisterFirm(): void {
    this.registerFirm.emit();
  }
}
