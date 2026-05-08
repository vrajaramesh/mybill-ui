import { Component, SimpleChanges } from '@angular/core';
import { ProductListComponent } from './product-list/product-list.component';
import { PurchaseListComponent } from './purchase-list/purchase-list.component';
import { BillingComponent } from './billing/billing.component';
import { GstReportComponent } from './gst-report/gst-report.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProductListComponent, PurchaseListComponent, BillingComponent, GstReportComponent, FormsModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  sidebarCollapsed = false;
  expandedMenus: Set<string> = new Set(['billing']); // billing open by default

  activeMenu: string = 'billing';
  activeSubMenu: string = 'transactions';
  billingView: 'list' | 'form' = 'list';

  get activeSection(): string {
    if (this.activeMenu === 'billing') return 'billing';
    return this.activeMenu;
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
    // Auto-expand menu
    this.expandedMenus.add(menu);
  }

  onBillingViewChange(view: 'list' | 'form'): void {
    this.billingView = view;
    this.activeSubMenu = view === 'form' ? 'new-bill' : 'transactions';
  }
}