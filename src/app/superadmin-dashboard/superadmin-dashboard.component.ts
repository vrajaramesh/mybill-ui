import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirmService, Firm, FirmRegistration } from '../firm.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-superadmin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin-dashboard.component.html',
  styleUrls: ['./superadmin-dashboard.component.css']
})
export class SuperadminDashboardComponent implements OnInit {
  @Output() logout = new EventEmitter<void>();

  firms: Firm[] = [];
  loadingFirms = false;
  firmsError = '';

  showCreateForm = false;
  firmName = '';
  firmCode = '';
  ownerEmail = '';
  adminUsername = '';
  adminPassword = '';
  confirmPassword = '';
  adminFullName = '';
  creating = false;
  createError = '';
  createSuccess = '';

  constructor(private firmService: FirmService, public authService: AuthService) {}

  ngOnInit(): void {
    this.loadFirms();
  }

  loadFirms(): void {
    this.loadingFirms = true;
    this.firmsError = '';
    this.firmService.listFirms().subscribe({
      next: (firms) => {
        this.firms = firms;
        this.loadingFirms = false;
      },
      error: (err) => {
        this.firmsError = err.error?.error || 'Failed to load firms';
        this.loadingFirms = false;
      }
    });
  }

  generateFirmCode(): void {
    if (this.firmName?.trim()) {
      this.firmCode = this.firmName.trim().toLowerCase()
        .replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    }
  }

  onCreateFirm(): void {
    this.createError = '';
    if (!this.firmName || !this.firmCode || !this.ownerEmail || !this.adminUsername || !this.adminPassword || !this.adminFullName) {
      this.createError = 'All fields are required';
      return;
    }
    if (this.adminPassword !== this.confirmPassword) {
      this.createError = 'Passwords do not match';
      return;
    }
    if (this.adminPassword.length < 6) {
      this.createError = 'Password must be at least 6 characters';
      return;
    }

    this.creating = true;
    const data: FirmRegistration = {
      firmName: this.firmName.trim(),
      firmCode: this.firmCode.trim().toLowerCase(),
      ownerEmail: this.ownerEmail.trim(),
      adminUsername: this.adminUsername.trim(),
      adminPassword: this.adminPassword,
      adminFullName: this.adminFullName.trim()
    };

    this.firmService.registerFirm(data).subscribe({
      next: (resp) => {
        this.creating = false;
        this.createSuccess = `Firm "${resp.firmName}" created! Admin can now log in with firm code: ${resp.firmCode}`;
        this.resetForm();
        this.loadFirms();
        setTimeout(() => { this.showCreateForm = false; this.createSuccess = ''; }, 4000);
      },
      error: (err) => {
        this.creating = false;
        this.createError = err.error?.error || 'Failed to create firm';
      }
    });
  }

  resetForm(): void {
    this.firmName = '';
    this.firmCode = '';
    this.ownerEmail = '';
    this.adminUsername = '';
    this.adminPassword = '';
    this.confirmPassword = '';
    this.adminFullName = '';
    this.createError = '';
  }

  get currentUser() { return this.authService.getCurrentUser(); }
  get currentUserInitials(): string {
    const name = this.currentUser?.fullName || this.currentUser?.username || '';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  onLogout(): void {
    this.authService.logout();
    this.logout.emit();
  }
}
