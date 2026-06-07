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
import { EcomOrdersComponent } from './ecom-orders/ecom-orders.component';
import { ChatInsightsComponent } from './chat-insights/chat-insights.component';
import { AiConfigComponent } from './ai-config/ai-config.component';
import { EcomCoverageComponent } from './ecom-coverage/ecom-coverage.component';
import { HermesComponent } from './hermes/hermes.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, CurrentUser } from './auth.service';
import { SettingsService } from './settings.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ProductListComponent, PurchaseListComponent, BillingComponent,
    GstReportComponent, UserManagementComponent, ReportsComponent, BoutiqueComponent,
    SettingsComponent, ProductCategoryComponent, ProductMediaComponent,
    LoginComponent, RegisterFirmComponent, SuperadminDashboardComponent,
    EcomOrdersComponent, ChatInsightsComponent, AiConfigComponent, HermesComponent,
    EcomCoverageComponent, FormsModule, CommonModule
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
  newOrderCount = 0;

  constructor(
    private authService: AuthService,
    private settingsService: SettingsService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      if (this.authService.isSuperadmin()) {
        this.currentView = 'superadmin';
      } else {
        this.currentView = 'app';
        this.loadNewOrderCount();
      }
    }
  }

  loadNewOrderCount(): void {
    const token = localStorage.getItem('mybill_token');
    if (!token) return;
    this.http.get<{ count: number }>('/api/ecom-orders/count/new',
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) })
      .subscribe({ next: r => { this.newOrderCount = r.count; }, error: () => {} });
  }

  get isInFirmContext(): boolean {
    return this.authService.isInFirmContext();
  }

  get firmContextName(): string {
    return this.authService.getCurrentFirm()?.firmName || '';
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
    return this.authService.isAdmin() || this.authService.isInFirmContext();
  }

  get isSales(): boolean {
    return this.authService.isSales();
  }

  get currentUserInitials(): string {
    const name = this.currentUser?.fullName || this.currentUser?.username || '';
    if (!name) return '?';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  get activeSection(): string {
    if (this.activeMenu === 'products') {
      if (this.activeSubMenu === 'categories')   return 'categories';
      if (this.activeSubMenu === 'media')        return 'media';
      if (this.activeSubMenu === 'ai-config')    return 'ai-config';
      if (this.activeSubMenu === 'ecom-coverage') return 'ecom-coverage';
      return 'products';
    }
    if (this.activeMenu === 'reports') {
      if (this.activeSubMenu === 'gst')   return 'gst-report';
      if (this.activeSubMenu === 'chat')  return 'chat-insights';
      return 'reports';
    }
    if (this.activeMenu === 'hermes') return 'hermes';
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

  onEnterFirm(firmCode: string): void {
    this.authService.enterFirmAsSuperadmin(firmCode).subscribe({
      next: () => {
        this.currentView = 'app';
        this.activeMenu = 'billing';
        this.activeSubMenu = 'transactions';
        this.billingView = 'list';
        this.expandedMenus = new Set(['billing']);
      },
      error: err => alert(err.error?.error || 'Failed to enter firm')
    });
  }

  backToSuperadmin(): void {
    this.authService.exitFirmAsSuperadmin();
    this.currentView = 'superadmin';
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
    // Refresh new-order badge when opening any section
    if (menu === 'ecom-orders') this.newOrderCount = 0; // clear badge on open
    else this.loadNewOrderCount();
  }

  onBillingViewChange(view: 'list' | 'form'): void {
    this.billingView = view;
    this.activeSubMenu = view === 'form' ? 'new-bill' : 'transactions';
  }
}
