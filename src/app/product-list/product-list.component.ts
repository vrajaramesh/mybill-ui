import { Component, OnInit } from '@angular/core';
import { ProductService } from '../product.service';
import { Product } from '../product.model';
import { ProductCategory } from '../product-category.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css'
})
export class ProductListComponent implements OnInit {
  products: Product[] = [];
  selectedProduct: Product | null = null;
  searchTerm: string = '';
  selectedCategory: string = '';
  selectedUnit: string = '';
  categories: string[] = [];
  units: string[] = [];
  productCategories: ProductCategory[] = [];

  constructor(private productService: ProductService) { }

  ngOnInit(): void {
    this.loadProducts();
    this.loadProductCategories();
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe(data => {
      this.products = data;
      this.extractFilters();
    });
  }

  loadProductCategories(): void {
    this.productService.getProductCategories().subscribe(data => {
      this.productCategories = data;
    });
  }

  extractFilters(): void {
    this.categories = [...new Set(this.products.map(p => p.category?.categoryName).filter((c): c is string => c !== undefined))];
    this.units = [...new Set(this.products.map(p => p.unit).filter((u): u is string => u !== undefined))];
  }

  get filteredProducts(): Product[] {
    return this.products.filter(product => {
      const matchesSearch = !this.searchTerm ||
        product.productName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(this.searchTerm.toLowerCase()));

      const matchesCategory = !this.selectedCategory || product.category?.categoryName === this.selectedCategory;

      const matchesUnit = !this.selectedUnit || product.unit === this.selectedUnit;

      return matchesSearch && matchesCategory && matchesUnit;
    });
  }

  selectProduct(product: Product): void {
    this.selectedProduct = { ...product };
  }

  deleteProduct(id: number): void {
    if (confirm('Are you sure you want to delete this product?')) {
      this.productService.deleteProduct(id).subscribe(() => {
        this.loadProducts();
      });
    }
  }

  addNewProduct(): void {
    this.selectedProduct = {
      productName: '',
      sellingPrice: 0,
      unit: 'Meters'
    };
  }

  saveProduct(): void {
    if (this.selectedProduct) {
      if (this.selectedProduct.productId) {
        this.productService.updateProduct(this.selectedProduct.productId, this.selectedProduct).subscribe({
          next: () => {
            this.loadProducts();
            this.selectedProduct = null;
          },
          error: (err) => {
            console.error('Error updating product:', err);
            alert('Error updating product: ' + (err.error?.message || err.message));
          }
        });
      } else {
        this.productService.createProduct(this.selectedProduct).subscribe({
          next: () => {
            this.loadProducts();
            this.selectedProduct = null;
          },
          error: (err) => {
            console.error('Error creating product:', err);
            alert('Error creating product: ' + (err.error?.message || err.message));
          }
        });
      }
    }
  }

  cancelEdit(): void {
    this.selectedProduct = null;
  }
}
