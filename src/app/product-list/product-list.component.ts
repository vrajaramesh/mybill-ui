import { Component, OnInit } from '@angular/core';
import { ProductService } from '../product.service';
import { Product, ProductImage } from '../product.model';
import { ProductCategory, ProductSubCategory } from '../product-category.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiPhotoWorkflowComponent } from '../ai-photo-workflow/ai-photo-workflow.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, AiPhotoWorkflowComponent],
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
  loadError: string = '';
  isLoading = false;
  aiPhotoProduct: Product | null = null;

  filteredSubCategories: ProductSubCategory[] = [];
  productImages: ProductImage[] = [];
  uploadingCount = 0;
  generatingDesc = false;

  readonly availableTags = ['Casual', 'Formal', 'Party', 'Wedding', 'Festival', 'Traditional', 'Office', 'Bridal'];
  readonly availableUsages = ['Saree', 'Kurti', 'Dress', 'Frock', 'Blouse', 'Lehenga', 'Salwar', 'Dupatta', 'Kids Wear'];

  constructor(private productService: ProductService) { }

  ngOnInit(): void {
    this.loadProducts();
    this.loadProductCategories();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.loadError = '';
    this.productService.getProducts().subscribe({
      next: data => {
        this.products = data;
        this.extractFilters();
        this.isLoading = false;
      },
      error: err => {
        this.loadError = err.error?.message || err.message || 'Failed to load products';
        this.isLoading = false;
      }
    });
  }

  loadProductCategories(): void {
    this.productService.getProductCategories().subscribe(data => {
      this.productCategories = data;
    });
  }

  onCategoryChange(cat: any): void {
    if (!this.selectedProduct) return;
    this.selectedProduct.subCategory = undefined;
    this.filteredSubCategories = [];
    const name = cat?.categoryName;
    if (name) {
      this.productService.getSubCategories(name).subscribe(data => {
        this.filteredSubCategories = data;
      });
    }
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

  compareCategory(a: any, b: any): boolean {
    return a?.categoryName === b?.categoryName;
  }

  isSubCatSelected(sc: ProductSubCategory): boolean {
    return this.selectedProduct?.subCategory?.id === sc.id;
  }

  selectSubCat(sc: ProductSubCategory): void {
    if (!this.selectedProduct) return;
    this.selectedProduct.subCategory = this.isSubCatSelected(sc) ? undefined : sc;
  }

  isUsageSelected(usage: string): boolean {
    return this.selectedProduct?.suitableFor?.split(',').map(t => t.trim()).includes(usage) ?? false;
  }

  toggleUsage(usage: string, checked: boolean): void {
    if (!this.selectedProduct) return;
    const current = this.selectedProduct.suitableFor ? this.selectedProduct.suitableFor.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (checked) {
      if (!current.includes(usage)) current.push(usage);
    } else {
      const idx = current.indexOf(usage);
      if (idx >= 0) current.splice(idx, 1);
    }
    this.selectedProduct.suitableFor = current.join(', ');
  }

  isTagSelected(tag: string): boolean {
    return this.selectedProduct?.tags?.split(',').map(t => t.trim()).includes(tag) ?? false;
  }

  toggleTag(tag: string, checked: boolean): void {
    if (!this.selectedProduct) return;
    const current = this.selectedProduct.tags ? this.selectedProduct.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (checked) {
      if (!current.includes(tag)) current.push(tag);
    } else {
      const idx = current.indexOf(tag);
      if (idx >= 0) current.splice(idx, 1);
    }
    this.selectedProduct.tags = current.join(', ');
  }

  subCategoryLabel(product: Product): string {
    return product.subCategory?.subCatName ?? '—';
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  selectProduct(product: Product): void {
    this.selectedProduct = { ...product };
    this.filteredSubCategories = [];
    this.productImages = [];
    const catName = product.category?.categoryName;
    if (catName) {
      this.productService.getSubCategories(catName).subscribe(data => {
        this.filteredSubCategories = data;
      });
    }
    if (product.productId) {
      this.productService.getProductImages(product.productId).subscribe(imgs => {
        this.productImages = imgs;
      });
    }
  }

  deleteProduct(id: number): void {
    if (confirm('Are you sure you want to delete this product?')) {
      this.productService.deleteProduct(id).subscribe(() => this.loadProducts());
    }
  }

  addNewProduct(): void {
    this.selectedProduct = {
      productName: '',
      sellingPrice: 0,
      unit: 'Meters',
      isOnline: true,
      isActive: true,
      subCategory: undefined
    };
    this.filteredSubCategories = [];
    this.productImages = [];
  }

  saveProduct(): void {
    if (!this.selectedProduct) return;
    if (this.selectedProduct.productId) {
      this.productService.updateProduct(this.selectedProduct.productId, this.selectedProduct).subscribe({
        next: () => {
          this.loadProducts();
          this.selectedProduct = null;
          this.productImages = [];
        },
        error: (err) => alert('Error updating product: ' + (err.error?.message || err.message))
      });
    } else {
      this.productService.createProduct(this.selectedProduct).subscribe({
        next: (created) => {
          this.loadProducts();
          this.selectedProduct = created;
          this.productImages = [];
        },
        error: (err) => alert('Error creating product: ' + (err.error?.message || err.message))
      });
    }
  }

  generateDescription(): void {
    if (!this.selectedProduct || this.generatingDesc) return;
    this.generatingDesc = true;
    const firstImage = this.productImages.find(i => i.mediaType !== 'video')?.imageUrl ?? undefined;
    this.productService.generateDescription(
      this.selectedProduct.productName,
      this.selectedProduct.category?.categoryName,
      this.selectedProduct.suitableFor ?? undefined,
      this.selectedProduct.tags ?? undefined,
      firstImage
    ).subscribe({
      next: (res) => {
        if (this.selectedProduct) this.selectedProduct.description = res.description;
        this.generatingDesc = false;
      },
      error: () => {
        alert('AI description generation failed. Please try again.');
        this.generatingDesc = false;
      }
    });
  }

  cancelEdit(): void {
    this.selectedProduct = null;
    this.productImages = [];
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !this.selectedProduct?.productId) return;
    const files = Array.from(input.files);
    input.value = '';
    files.forEach(file => {
      this.uploadingCount++;
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      this.productService.uploadToCloudinary(file).subscribe({
        next: (res: any) => {
          const productId = this.selectedProduct?.productId;
          if (!productId) { this.uploadingCount--; return; }
          this.productService.saveProductImage(productId, res.secure_url, res.public_id, mediaType).subscribe({
            next: (img) => { this.productImages.push(img); this.uploadingCount--; },
            error: (err) => { alert('File saved to cloud but DB failed: ' + (err.error?.message || err.message)); this.uploadingCount--; }
          });
        },
        error: () => { alert('Failed to upload file. Please try again.'); this.uploadingCount--; }
      });
    });
  }

  deleteImage(img: ProductImage): void {
    if (!this.selectedProduct?.productId || !img.imageId) return;
    this.productService.deleteProductImage(this.selectedProduct.productId, img.imageId).subscribe(() => {
      this.productImages = this.productImages.filter(i => i.imageId !== img.imageId);
    });
  }

  get isUploading(): boolean { return this.uploadingCount > 0; }

  openAIPhotoWorkflow(product: Product): void {
    this.aiPhotoProduct = product;
  }

  onAIPhotoSaved(): void {
    this.loadProducts();
    if (this.selectedProduct?.productId) {
      this.productService.getProductImages(this.selectedProduct.productId).subscribe(imgs => {
        this.productImages = imgs;
      });
    }
    this.aiPhotoProduct = null;
  }

  closeAIPhotoWorkflow(): void {
    this.aiPhotoProduct = null;
  }
}
