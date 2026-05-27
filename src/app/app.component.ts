import { Component, OnInit } from '@angular/core';
import { ProductListComponent } from './product-list/product-list.component';
import { PurchaseListComponent } from './purchase-list/purchase-list.component';
import { BillingComponent } from './billing/billing.component';
import { GstReportComponent } from './gst-report/gst-report.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { ReportsComponent } from './reports/reports.component';
import { BoutiqueComponent } from './boutique/boutique.component';
import { SettingsComponent } from './settings/settings.component';
import { ProductCategoryComponent } from './product-category/product-category.component';
import { ProductMediaComponent } from './product-media/product-media.component';
import { LoginComponent } from './login/login.component';
import { RegisterFirmComponent } from './register-firm/register-firm.component';
import { SuperadminDashboardComponent } from './superadmin-dashboard/superadmin-dashboard.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, CurrentUser } from './auth.service';
import { SettingsService } from './settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ProductListComponent, PurchaseListComponent, BillingComponent,
    GstReportComponent, UserManagementComponent, ReportsComponent, BoutiqueComponent,
    SettingsComponent, ProductCategoryComponent, ProductMediaComponent,
    LoginComponent, RegisterFirmComponent, SuperadminDashboardComponent,
    FormsModule, CommonModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  sidebarCollapsed = false;
  expandedMenus: Set<string> = new Set(['billing']);
  currentView: 'login' | 'register' | 'app' | 'superadmin' = 'login';

  activeMenu: string = 'billing';
  activeSubMenu: string = 'transactions';
  billingView: 'list' | 'form' = 'list';

  constructor(private authService: AuthService, private settingsService: SettingsService) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      if (this.authService.isSuperadmin()) {
        this.currentView = 'superadmin';
      } else {
        this.currentView = 'app';
      }
    }
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get currentUser(): CurrentUser | null {
    return this.authService.getCurrentUser();
  }

  get displayFirmName(): string {
    return this.settingsService.firmName || this.currentUser?.firmName || 'MyBill';
  }

  get displayLogo(): string {
    return this.settingsService.logo;
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  get currentUserInitials(): string {
    const name = this.currentUser?.fullName || this.currentUser?.username || '';
    if (!name) return '?';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  get activeSection(): string {
    if (this.activeMenu === 'products') {
      if (this.activeSubMenu === 'categories') return 'categories';
      if (this.activeSubMenu === 'media') return 'media';
      return 'products';
    }
    if (this.activeMenu === 'reports') {
      return this.activeSubMenu === 'gst' ? 'gst-report' : 'reports';
    }
    return this.activeMenu;
  }

  onLoginSuccess(): void {
    if (this.authService.isSuperadmin()) {
      this.currentView = 'superadmin';
    } else {
      this.currentView = 'app';
      this.activeMenu = 'billing';
      this.activeSubMenu = 'transactions';
      this.billingView = 'list';
      this.expandedMenus = new Set(['billing']);
    }
  }

  onSuperadminLogout(): void {
    this.authService.logout();
    this.currentView = 'login';
  }

  onRegisterFirmSuccess(): void {
    this.currentView = 'login';
  }

  goToRegister(): void {
    this.currentView = 'register';
  }

  goBackToLogin(): void {
    this.currentView = 'login';
  }

  logout(): void {
    this.authService.logout();
    this.currentView = 'login';
    this.activeMenu = 'billing';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleMenu(menu: string): void {
    if (this.expandedMenus.has(menu)) {
      this.expandedMenus.delete(menu);
    } else {
      this.expandedMenus.add(menu);
    }
  }

  isMenuExpanded(menu: string): boolean {
    return this.expandedMenus.has(menu);
  }

  navigate(menu: string, sub?: string): void {
    this.activeMenu = menu;
    if (sub) {
      this.activeSubMenu = sub;
      if (menu === 'billing') {
        this.billingView = sub === 'new-bill' ? 'form' : 'list';
      }
    }
    this.expandedMenus.add(menu);
  }

  onBillingViewChange(view: 'list' | 'form'): void {
    this.billingView = view;
    this.activeSubMenu = view === 'form' ? 'new-bill' : 'transactions';
  }
}
