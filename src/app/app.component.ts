import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
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
import { BoutiqueOrdersComponent } from './boutique-orders/boutique-orders.component';
import { AdLinksComponent } from './ad-links/ad-links.component';
import { AdPerformanceComponent } from './ad-performance/ad-performance.component';
import { ChatInsightsComponent } from './chat-insights/chat-insights.component';
import { AiConfigComponent } from './ai-config/ai-config.component';
import { EcomCoverageComponent } from './ecom-coverage/ecom-coverage.component';
import { HermesComponent } from './hermes/hermes.component';
import { ExpensesComponent } from './expenses/expenses.component';
import { AiInsightsComponent } from './ai-insights/ai-insights.component';
import { WholesaleProductsComponent } from './wholesale/wholesale-products/wholesale-products.component';
import { WholesaleCustomersComponent } from './wholesale/wholesale-customers/wholesale-customers.component';
import { WholesaleSettingsComponent } from './wholesale/wholesale-settings/wholesale-settings.component';
import { WholesaleQuotationsComponent } from './wholesale/wholesale-quotations/wholesale-quotations.component';
import { WholesaleSalesDocumentsComponent } from './wholesale/wholesale-sales-documents/wholesale-sales-documents.component';
import { WholesaleStockComponent } from './wholesale/wholesale-stock/wholesale-stock.component';
import { WholesaleInstagramComponent } from './wholesale/wholesale-instagram/wholesale-instagram.component';
import { WholesaleAssistantComponent } from './wholesale/wholesale-assistant/wholesale-assistant.component';
import { WholesalePurchasesComponent } from './wholesale/wholesale-purchases/wholesale-purchases.component';
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
    EcomOrdersComponent, BoutiqueOrdersComponent, AdLinksComponent, AdPerformanceComponent, ChatInsightsComponent, AiConfigComponent, HermesComponent,
    EcomCoverageComponent, ExpensesComponent, AiInsightsComponent, WholesaleProductsComponent, WholesaleCustomersComponent, WholesaleSettingsComponent, WholesaleQuotationsComponent, WholesaleSalesDocumentsComponent, WholesaleStockComponent, WholesaleInstagramComponent, WholesaleAssistantComponent, WholesalePurchasesComponent,
    FormsModule, CommonModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
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

  private sessionTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.keepSessionFresh();
    this.sessionTimer = setInterval(() => this.keepSessionFresh(), 60 * 60 * 1000);
    if (this.authService.isLoggedIn()) {
      if (this.authService.isSuperadmin()) {
        this.currentView = 'superadmin';
      } else if (this.authService.isEcom()) {
        this.currentView = 'app';
        this.activeMenu = 'products';
        this.activeSubMenu = 'ecom-coverage';
        this.expandedMenus = new Set(['products']);
      } else {
        this.currentView = 'app';
        this.loadNewOrderCount();
      }
      if (this.currentView === 'app') this.settingsService.loadFromBackend();
    }
  }

  ngOnDestroy(): void {
    if (this.sessionTimer) clearInterval(this.sessionTimer);
  }

  /** Coming back to the tab (e.g. next morning): renew the session before the user starts working. */
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') this.keepSessionFresh();
  }

  /** Sliding session — renews the login token while the app is in use; shows login only if the server refuses. */
  private keepSessionFresh(): void {
    if (!this.authService.getToken()) return;
    if (!this.authService.isLoggedIn()) { this.currentView = 'login'; return; }
    this.authService.refreshSessionIfNeeded().subscribe(sessionEnded => {
      if (sessionEnded) this.logout();
    });
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

  /** Wholesale → Business Profile / Bank Details / UPI Details / Document Types & Numbering. */
  get isWholesaleSettingsSub(): boolean {
    return this.activeMenu === 'wholesale' && ['ws-profile', 'ws-bank', 'ws-upi', 'ws-numbering'].includes(this.activeSubMenu);
  }

  get isSales(): boolean {
    return this.authService.isSales();
  }

  get isEcom(): boolean {
    return this.authService.isEcom();
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
    if (this.activeMenu === 'wholesale') {
      if (this.isWholesaleSettingsSub) return 'wholesale-settings';
      return 'wholesale-' + (this.activeSubMenu || 'products');
    }
    return this.activeMenu;
  }

  onLoginSuccess(): void {
    this.settingsService.loadFromBackend();   // this firm's store name / phone, not the previous firm's
    if (this.authService.isSuperadmin()) {
      this.currentView = 'superadmin';
    } else if (this.authService.isEcom()) {
      this.currentView = 'app';
      this.activeMenu = 'products';
      this.activeSubMenu = 'ecom-coverage';
      this.expandedMenus = new Set(['products']);
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
        this.settingsService.loadFromBackend();
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

  /** Opens the Wholesale menu (Products first) or collapses it. */
  onWholesaleClick(): void {
    this.toggleMenu('wholesale');
    if (this.activeMenu !== 'wholesale') this.navigate('wholesale', 'products');
  }

  /** Wholesale sub-menu click. On phones the sidebar collapses afterwards so the billing screen gets the full width. */
  navigateWholesale(sub: string): void {
    this.navigate('wholesale', sub);
    if (typeof window !== 'undefined' && window.innerWidth <= 768) this.sidebarCollapsed = true;
  }

  onBillingViewChange(view: 'list' | 'form'): void {
    this.billingView = view;
    this.activeSubMenu = view === 'form' ? 'new-bill' : 'transactions';
  }
}
