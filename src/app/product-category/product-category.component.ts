import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../product.service';
import { ProductCategory, ProductSubCategory } from '../product-category.model';

@Component({
  selector: 'app-product-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-category.component.html',
  styleUrl: './product-category.component.css'
})
export class ProductCategoryComponent implements OnInit {
  categories: ProductCategory[] = [];
  subCategories: ProductSubCategory[] = [];

  selectedCategoryName: string | null = null;
  newCategoryName = '';
  addingCategory = false;
  savingCategory = false;

  newSubCatName = '';
  addingSubCat = false;
  savingSubCat = false;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadAllSubCategories();
  }

  loadCategories(): void {
    this.productService.getProductCategories().subscribe(data => {
      this.categories = data;
    });
  }

  loadAllSubCategories(): void {
    this.productService.getAllSubCategories().subscribe(data => {
      this.subCategories = data;
    });
  }

  get selectedCategory(): ProductCategory | null {
    return this.categories.find(c => c.categoryName === this.selectedCategoryName) ?? null;
  }

  get subCatsForSelected(): ProductSubCategory[] {
    return this.subCategories.filter(sc => sc.category?.categoryName === this.selectedCategoryName);
  }

  selectCategory(cat: ProductCategory): void {
    this.selectedCategoryName = cat.categoryName;
    this.addingSubCat = false;
    this.newSubCatName = '';
  }

  toggleCategoryOnline(cat: ProductCategory): void {
    const newVal = !cat.isOnline;
    this.productService.updateProductCategory(cat.categoryName, newVal).subscribe(() => {
      cat.isOnline = newVal;
    });
  }

  addCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;
    this.savingCategory = true;
    this.productService.createProductCategory(name).subscribe({
      next: (created) => {
        this.categories.push(created);
        this.newCategoryName = '';
        this.addingCategory = false;
        this.savingCategory = false;
      },
      error: (err) => {
        alert('Error: ' + (err.error?.message || err.message || 'Category may already exist'));
        this.savingCategory = false;
      }
    });
  }

  deleteCategory(cat: ProductCategory): void {
    if (!confirm(`Delete category "${cat.categoryName}"? All products in this category will lose their category.`)) return;
    this.productService.deleteProductCategory(cat.categoryName).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.categoryName !== cat.categoryName);
        this.subCategories = this.subCategories.filter(sc => sc.category?.categoryName !== cat.categoryName);
        if (this.selectedCategoryName === cat.categoryName) this.selectedCategoryName = null;
      },
      error: (err) => alert('Error deleting category: ' + (err.error?.message || err.message))
    });
  }

  toggleSubCatOnline(sc: ProductSubCategory): void {
    const newVal = !sc.isOnline;
    this.productService.updateSubCategory(sc.id!, { isOnline: newVal, subCatName: sc.subCatName, category: sc.category }).subscribe(() => {
      sc.isOnline = newVal;
    });
  }

  addSubCategory(): void {
    const name = this.newSubCatName.trim();
    if (!name || !this.selectedCategoryName) return;
    this.savingSubCat = true;
    this.productService.createSubCategory(name, this.selectedCategoryName).subscribe({
      next: (created) => {
        this.subCategories.push(created);
        this.newSubCatName = '';
        this.addingSubCat = false;
        this.savingSubCat = false;
      },
      error: (err) => {
        alert('Error: ' + (err.error?.message || err.message));
        this.savingSubCat = false;
      }
    });
  }

  getSubCatCount(categoryName: string): number {
    return this.subCategories.filter(sc => sc.category?.categoryName === categoryName).length;
  }

  deleteSubCategory(sc: ProductSubCategory): void {
    if (!confirm(`Delete sub-category "${sc.subCatName}"?`)) return;
    this.productService.deleteSubCategory(sc.id!).subscribe({
      next: () => {
        this.subCategories = this.subCategories.filter(s => s.id !== sc.id);
      },
      error: (err) => alert('Error: ' + (err.error?.message || err.message))
    });
  }
}
