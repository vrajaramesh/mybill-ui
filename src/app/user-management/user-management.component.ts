import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, AdminUser } from '../user.service';
import { AuthService } from '../auth.service';

interface SalesForm {
  username: string; password: string; fullName: string;
  email: string; phone: string; isActive: boolean; firmCode: string;
}

interface AdminForm {
  username: string; password: string; fullName: string;
  email: string; phone: string; firmCodes: string[];
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {

  // ── Tabs ──────────────────────────────────────────────────────────────────
  activeTab: 'sales' | 'admins' | 'ecom' = 'sales';

  // ── Firms ─────────────────────────────────────────────────────────────────
  allFirms: any[] = [];
  selectedFirmCode: string = '';

  // ── Sales users ───────────────────────────────────────────────────────────
  salesUsers: any[] = [];
  salesLoading = false;
  salesError = '';

  // ── Admin users ───────────────────────────────────────────────────────────
  adminUsers: AdminUser[] = [];
  adminsLoading = false;
  adminsError = '';

  // ── Ecom users ────────────────────────────────────────────────────────────
  ecomUsers: any[] = [];
  ecomLoading = false;
  ecomError = '';
  showEcomModal = false;
  ecomForm: SalesForm = this.emptySalesForm();
  ecomFormError = '';
  ecomFormLoading = false;

  // ── Common ────────────────────────────────────────────────────────────────
  successMsg = '';

  // ── Sales modal ───────────────────────────────────────────────────────────
  showSalesModal = false;
  salesModalMode: 'create' | 'edit' = 'create';
  editingSalesId: number | null = null;
  salesForm: SalesForm = this.emptySalesForm();
  salesFormError = '';
  salesFormLoading = false;

  // ── Admin modal ───────────────────────────────────────────────────────────
  showAdminModal = false;
  adminModalMode: 'create' | 'edit' = 'create';
  editingAdminId: number | null = null;
  adminForm: AdminForm = this.emptyAdminForm();
  adminFormError = '';
  adminFormLoading = false;

  // ── Firm assignment panel ─────────────────────────────────────────────────
  assigningAdmin: AdminUser | null = null;

  // ── Password modal ────────────────────────────────────────────────────────
  showPwModal = false;
  pwForm = { newPassword: '', confirmPassword: '' };
  pwTarget: { id: number; name: string; isSalesUser: boolean; firmCode?: string } | null = null;
  pwError = '';
  pwLoading = false;

  // ── Delete confirm ────────────────────────────────────────────────────────
  deleteTarget: { id: number; name: string; firmCode?: string } | null = null;

  constructor(private userService: UserService, public auth: AuthService) {}

  get isSuperadmin() { return this.auth.isSuperadminIdentity(); }

  ngOnInit(): void {
    this.loadFirms();
  }

  // ── Firms ─────────────────────────────────────────────────────────────────

  loadFirms(): void {
    this.userService.getAccessibleFirms().subscribe({
      next: firms => {
        this.allFirms = firms;
        if (firms.length > 0) {
          // ADMIN logged into a firm: selectedFirmCode from their JWT
          const currentFirm = this.auth.getCurrentFirm();
          this.selectedFirmCode = currentFirm?.firmCode ?? (firms[0]?.firm_code ?? firms[0]?.firmCode ?? '');
        }
        this.loadSalesUsers();
        this.loadEcomUsers();
        if (this.isSuperadmin) this.loadAdmins();
      },
      error: () => { this.salesError = 'Failed to load firms'; }
    });
  }

  onFirmChange(): void {
    this.loadSalesUsers();
    this.loadEcomUsers();
  }

  firmCodeOf(f: any): string { return f.firm_code ?? f.firmCode ?? ''; }
  firmNameOf(f: any): string { return f.firm_name ?? f.firmName ?? ''; }

  // ── Sales users ───────────────────────────────────────────────────────────

  loadSalesUsers(): void {
    this.salesLoading = true;
    this.salesError = '';
    const firmCode = this.isSuperadmin ? this.selectedFirmCode : undefined;
    this.userService.getSalesUsers(firmCode).subscribe({
      next: users => { this.salesUsers = users; this.salesLoading = false; },
      error: () => { this.salesError = 'Failed to load users'; this.salesLoading = false; }
    });
  }

  openCreateSalesModal(): void {
    this.salesForm = this.emptySalesForm();
    this.salesForm.firmCode = this.selectedFirmCode;
    this.salesFormError = '';
    this.salesModalMode = 'create';
    this.editingSalesId = null;
    this.showSalesModal = true;
  }

  openEditSalesModal(u: any): void {
    this.salesForm = {
      username:  u.username,
      password:  '',
      fullName:  u.full_name || '',
      email:     u.email || '',
      phone:     u.phone || '',
      isActive:  u.is_active ?? true,
      firmCode:  this.selectedFirmCode
    };
    this.salesFormError = '';
    this.salesModalMode = 'edit';
    this.editingSalesId = u.user_id;
    this.showSalesModal = true;
  }

  closeSalesModal(): void { this.showSalesModal = false; }

  saveSalesUser(): void {
    this.salesFormError = '';
    if (!this.salesForm.fullName.trim()) { this.salesFormError = 'Full name is required'; return; }
    if (this.salesModalMode === 'create') {
      if (!this.salesForm.username.trim()) { this.salesFormError = 'Username is required'; return; }
      if (!this.salesForm.password || this.salesForm.password.length < 6) { this.salesFormError = 'Password must be at least 6 characters'; return; }
      if (!this.salesForm.firmCode) { this.salesFormError = 'Please select a firm'; return; }
    }
    this.salesFormLoading = true;

    if (this.salesModalMode === 'create') {
      this.userService.createSalesUser({
        firmCode: this.salesForm.firmCode,
        username: this.salesForm.username.trim(),
        password: this.salesForm.password,
        fullName: this.salesForm.fullName.trim(),
        email: this.salesForm.email || undefined,
        phone: this.salesForm.phone || undefined
      }).subscribe({
        next: () => { this.salesFormLoading = false; this.closeSalesModal(); this.showSuccess('User created'); this.loadSalesUsers(); },
        error: err => { this.salesFormLoading = false; this.salesFormError = err.error?.error || 'Error creating user'; }
      });
    } else {
      const firmCode = this.isSuperadmin ? this.selectedFirmCode : undefined;
      this.userService.updateSalesUser(this.editingSalesId!, {
        fullName: this.salesForm.fullName.trim(),
        email: this.salesForm.email || null,
        phone: this.salesForm.phone || null,
        isActive: this.salesForm.isActive,
        password: this.salesForm.password || undefined
      }, firmCode).subscribe({
        next: () => { this.salesFormLoading = false; this.closeSalesModal(); this.showSuccess('User updated'); this.loadSalesUsers(); },
        error: err => { this.salesFormLoading = false; this.salesFormError = err.error?.error || 'Error updating user'; }
      });
    }
  }

  toggleSalesStatus(u: any): void {
    const firmCode = this.isSuperadmin ? this.selectedFirmCode : undefined;
    this.userService.toggleSalesUserStatus(u.user_id, !u.is_active, firmCode).subscribe({
      next: () => this.loadSalesUsers(),
      error: () => { this.salesError = 'Failed to update status'; }
    });
  }

  confirmDeleteSales(u: any): void {
    this.deleteTarget = { id: u.user_id, name: u.full_name || u.username, firmCode: this.selectedFirmCode };
  }

  // ── Admin users ───────────────────────────────────────────────────────────

  loadAdmins(): void {
    this.adminsLoading = true;
    this.userService.getAdmins().subscribe({
      next: admins => { this.adminUsers = admins; this.adminsLoading = false; },
      error: () => { this.adminsError = 'Failed to load admin users'; this.adminsLoading = false; }
    });
  }

  openCreateAdminModal(): void {
    this.adminForm = this.emptyAdminForm();
    this.adminFormError = '';
    this.adminModalMode = 'create';
    this.editingAdminId = null;
    this.showAdminModal = true;
  }

  openEditAdminModal(a: AdminUser): void {
    this.adminForm = {
      username: a.username,
      password: '',
      fullName: a.full_name || '',
      email: a.email || '',
      phone: a.phone || '',
      firmCodes: (a.firms ?? []).filter(f => f.is_active).map(f => f.firm_code)
    };
    this.adminFormError = '';
    this.adminModalMode = 'edit';
    this.editingAdminId = a.user_id;
    this.showAdminModal = true;
  }

  closeAdminModal(): void { this.showAdminModal = false; }

  toggleFirmCodeInAdminForm(firmCode: string): void {
    const idx = this.adminForm.firmCodes.indexOf(firmCode);
    if (idx >= 0) this.adminForm.firmCodes.splice(idx, 1);
    else this.adminForm.firmCodes.push(firmCode);
  }

  isFirmSelectedInAdminForm(firmCode: string): boolean {
    return this.adminForm.firmCodes.includes(firmCode);
  }

  saveAdminUser(): void {
    this.adminFormError = '';
    if (!this.adminForm.fullName.trim()) { this.adminFormError = 'Full name is required'; return; }
    if (this.adminModalMode === 'create') {
      if (!this.adminForm.username.trim()) { this.adminFormError = 'Username is required'; return; }
      if (!this.adminForm.password || this.adminForm.password.length < 6) { this.adminFormError = 'Password must be at least 6 characters'; return; }
    }
    this.adminFormLoading = true;

    if (this.adminModalMode === 'create') {
      this.userService.createAdmin({
        username: this.adminForm.username.trim(),
        password: this.adminForm.password,
        fullName: this.adminForm.fullName.trim(),
        email: this.adminForm.email || undefined,
        phone: this.adminForm.phone || undefined,
        firmCodes: this.adminForm.firmCodes
      }).subscribe({
        next: () => { this.adminFormLoading = false; this.closeAdminModal(); this.showSuccess('Admin user created'); this.loadAdmins(); },
        error: err => { this.adminFormLoading = false; this.adminFormError = err.error?.error || 'Error creating admin'; }
      });
    } else {
      this.userService.updateAdmin(this.editingAdminId!, {
        fullName: this.adminForm.fullName.trim(),
        email: this.adminForm.email || null,
        phone: this.adminForm.phone || null,
        password: this.adminForm.password || undefined
      }).subscribe({
        next: () => { this.adminFormLoading = false; this.closeAdminModal(); this.showSuccess('Admin updated'); this.loadAdmins(); },
        error: err => { this.adminFormLoading = false; this.adminFormError = err.error?.error || 'Error updating admin'; }
      });
    }
  }

  // ── Firm assignment ────────────────────────────────────────────────────────

  openFirmAssignment(admin: AdminUser): void { this.assigningAdmin = admin; }
  closeFirmAssignment(): void { this.assigningAdmin = null; }

  adminHasFirm(firmId: number): boolean {
    return (this.assigningAdmin?.firms ?? []).some(f => f.firm_id === firmId && f.is_active);
  }

  toggleAdminFirm(firmId: number): void {
    if (!this.assigningAdmin) return;
    const has = this.adminHasFirm(firmId);
    const req = has
      ? this.userService.removeAdminFromFirm(this.assigningAdmin.user_id, firmId)
      : this.userService.assignAdminToFirm(this.assigningAdmin.user_id, firmId);
    req.subscribe({
      next: () => { this.showSuccess(has ? 'Access removed' : 'Firm assigned'); this.loadAdmins(); this.closeFirmAssignment(); },
      error: err => { this.adminsError = err.error?.error || 'Operation failed'; }
    });
  }

  // ── Password modal ────────────────────────────────────────────────────────

  openPwModal(id: number, name: string, isSalesUser: boolean, firmCode?: string): void {
    this.pwForm = { newPassword: '', confirmPassword: '' };
    this.pwError = '';
    this.pwTarget = { id, name, isSalesUser, firmCode };
    this.showPwModal = true;
  }

  closePwModal(): void { this.showPwModal = false; }

  savePw(): void {
    this.pwError = '';
    if (!this.pwForm.newPassword) { this.pwError = 'New password is required'; return; }
    if (this.pwForm.newPassword.length < 6) { this.pwError = 'Minimum 6 characters'; return; }
    if (this.pwForm.newPassword !== this.pwForm.confirmPassword) { this.pwError = 'Passwords do not match'; return; }
    if (!this.pwTarget) return;
    this.pwLoading = true;

    const req = this.pwTarget.isSalesUser
      ? this.userService.updateSalesUser(this.pwTarget.id, { password: this.pwForm.newPassword }, this.pwTarget.firmCode)
      : this.userService.updateAdmin(this.pwTarget.id, { password: this.pwForm.newPassword });

    req.subscribe({
      next: () => { this.pwLoading = false; this.closePwModal(); this.showSuccess('Password updated'); },
      error: () => { this.pwLoading = false; this.pwError = 'Failed to update password'; }
    });
  }

  // ── Delete confirm ────────────────────────────────────────────────────────

  cancelDelete(): void { this.deleteTarget = null; }

  doDelete(): void {
    if (!this.deleteTarget) return;
    const t = this.deleteTarget;
    this.deleteTarget = null;
    const firmCode = this.isSuperadmin ? t.firmCode : undefined;
    this.userService.toggleSalesUserStatus(t.id, false, firmCode).subscribe({
      next: () => { this.showSuccess('User deactivated'); this.loadSalesUsers(); },
      error: () => { this.salesError = 'Failed to deactivate user'; }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  initials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  get currentUserId(): number | null {
    return this.auth.getCurrentUser()?.userId ?? null;
  }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => { this.successMsg = ''; }, 3000);
  }

  private emptySalesForm(): SalesForm {
    return { username: '', password: '', fullName: '', email: '', phone: '', isActive: true, firmCode: '' };
  }

  private emptyAdminForm(): AdminForm {
    return { username: '', password: '', fullName: '', email: '', phone: '', firmCodes: [] };
  }

  // ── Ecom users ────────────────────────────────────────────────────────────

  loadEcomUsers(): void {
    const firmCode = this.selectedFirmCode;
    if (!firmCode) return;
    this.ecomLoading = true;
    this.ecomError = '';
    this.userService.getEcomUsers(firmCode).subscribe({
      next: users => { this.ecomUsers = users; this.ecomLoading = false; },
      error: () => { this.ecomError = 'Failed to load Ecom users'; this.ecomLoading = false; }
    });
  }

  openCreateEcomModal(): void {
    this.ecomForm = this.emptySalesForm();
    this.ecomForm.firmCode = this.selectedFirmCode;
    this.ecomFormError = '';
    this.showEcomModal = true;
  }

  closeEcomModal(): void { this.showEcomModal = false; }

  saveEcomUser(): void {
    this.ecomFormLoading = true;
    this.ecomFormError = '';
    this.userService.createEcomUser({
      firmCode: this.ecomForm.firmCode || this.selectedFirmCode,
      username: this.ecomForm.username,
      password: this.ecomForm.password,
      fullName: this.ecomForm.fullName,
      email: this.ecomForm.email,
      phone: this.ecomForm.phone
    }).subscribe({
      next: () => { this.ecomFormLoading = false; this.closeEcomModal(); this.showSuccess('Ecom user created'); this.loadEcomUsers(); },
      error: err => { this.ecomFormError = err.error?.error || 'Failed to create user'; this.ecomFormLoading = false; }
    });
  }

  toggleEcomStatus(u: any): void {
    this.userService.toggleEcomUserStatus(u.user_id, !u.is_active, this.selectedFirmCode).subscribe({
      next: () => this.loadEcomUsers(),
      error: () => alert('Failed to update status')
    });
  }
}
