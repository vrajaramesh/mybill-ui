import { Component } from '@angular/core';
import { ProductListComponent } from './product-list/product-list.component';
import { PurchaseListComponent } from './purchase-list/purchase-list.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProductListComponent, PurchaseListComponent, FormsModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'mybill-ui';
  activeTab: string = 'products';

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
}
