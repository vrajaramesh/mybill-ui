import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirmService, FirmRegistration } from '../firm.service';

@Component({
  selector: 'app-register-firm',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-firm.component.html',
  styleUrl: './register-firm.component.css'
})
export class RegisterFirmComponent {
  @Output() registrationSuccess = new EventEmitter<void>();
  @Output() backToLogin = new EventEmitter<void>();

  firmName: string = '';
  firmCode: string = '';
  ownerEmail: string = '';
  adminUsername: string = '';
  adminPassword: string = '';
  confirmPassword: string = '';
  adminFullName: string = '';

  loading: boolean = false;
  error: string = '';
  successMessage: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  constructor(private firmService: FirmService) {}

  /**
   * Validate form inputs
   */
  private validateForm(): boolean {
    this.error = '';

    if (!this.firmName?.trim()) {
      this.error = 'Firm name is required';
      return false;
    }

    if (!this.firmCode?.trim()) {
      this.error = 'Firm code is required';
      return false;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(this.firmCode)) {
      this.error = 'Firm code can only contain letters, numbers, underscores, and hyphens';
      return false;
    }

    if (!this.ownerEmail?.trim()) {
      this.error = 'Owner email is required';
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.ownerEmail)) {
      this.error = 'Invalid email format';
      return false;
    }

    if (!this.adminUsername?.trim()) {
      this.error = 'Admin username is required';
      return false;
    }

    if (this.adminUsername.length < 3) {
      this.error = 'Admin username must be at least 3 characters';
      return false;
    }

    if (!this.adminPassword) {
      this.error = 'Admin password is required';
      return false;
    }

    if (this.adminPassword.length < 6) {
      this.error = 'Admin password must be at least 6 characters';
      return false;
    }

    if (this.adminPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return false;
    }

    if (!this.adminFullName?.trim()) {
      this.error = 'Admin full name is required';
      return false;
    }

    return true;
  }

  /**
   * Submit registration form
   */
  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    this.successMessage = '';

    const registrationData: FirmRegistration = {
      firmName: this.firmName.trim(),
      firmCode: this.firmCode.trim().toLowerCase(),
      ownerEmail: this.ownerEmail.trim(),
      adminUsername: this.adminUsername.trim(),
      adminPassword: this.adminPassword,
      adminFullName: this.adminFullName.trim()
    };

    this.firmService.registerFirm(registrationData).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = `✅ Firm "${response.firmName}" registered successfully!`;
        this.resetForm();

        setTimeout(() => {
          this.registrationSuccess.emit();
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        const errorMessage = err.error?.error || err.error?.message || err.message || 'Registration failed';
        this.error = errorMessage;
        console.error('Registration error:', err);
      }
    });
  }

  /**
   * Reset form fields
   */
  resetForm(): void {
    this.firmName = '';
    this.firmCode = '';
    this.ownerEmail = '';
    this.adminUsername = '';
    this.adminPassword = '';
    this.confirmPassword = '';
    this.adminFullName = '';
    this.error = '';
  }

  /**
   * Handle back to login click
   */
  goBackToLogin(): void {
    this.resetForm();
    this.backToLogin.emit();
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Toggle confirm password visibility
   */
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /**
   * Auto-generate firm code from firm name
   */
  generateFirmCode(): void {
    if (this.firmName?.trim()) {
      this.firmCode = this.firmName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '');
    }
  }
}

