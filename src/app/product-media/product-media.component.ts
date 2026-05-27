import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../product.service';
import { Product, ProductImage } from '../product.model';

@Component({
  selector: 'app-product-media',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-media.component.html',
  styleUrl: './product-media.component.css'
})
export class ProductMediaComponent implements OnInit {
  products: Product[] = [];
  selectedProduct: Product | null = null;
  productImages: ProductImage[] = [];

  searchQuery = '';
  showDropdown = false;

  pendingFiles: File[] = [];
  filePreviews: { url: string; type: string; name: string }[] = [];

  isLoadingProducts = false;
  isLoadingImages = false;
  uploadingCount = 0;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.isLoadingProducts = true;
    this.productService.getProducts().subscribe({
      next: (p) => { this.products = p; this.isLoadingProducts = false; },
      error: () => { this.isLoadingProducts = false; }
    });
  }

  get filteredProductOptions(): Product[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.products;
    return this.products.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      String(p.productId).includes(q)
    );
  }

  productLabel(p: Product): string {
    return `#${p.productId} — ${p.productName}`;
  }

  onSearchFocus(): void {
    this.showDropdown = true;
  }

  onSearchInput(): void {
    this.showDropdown = true;
    if (this.selectedProduct && this.searchQuery !== this.productLabel(this.selectedProduct)) {
      this.selectedProduct = null;
      this.productImages = [];
      this.clearPending();
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.showDropdown = false;
      if (!this.selectedProduct) this.searchQuery = '';
    }, 200);
  }

  pickProduct(product: Product): void {
    this.selectedProduct = product;
    this.searchQuery = this.productLabel(product);
    this.showDropdown = false;
    this.productImages = [];
    this.clearPending();
    this.isLoadingImages = true;
    this.productService.getProductImages(product.productId!).subscribe({
      next: (imgs) => { this.productImages = imgs; this.isLoadingImages = false; },
      error: () => { this.isLoadingImages = false; }
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const files = Array.from(input.files);
    input.value = '';
    files.forEach(file => {
      this.pendingFiles.push(file);
      this.filePreviews.push({
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        name: file.name
      });
    });
  }

  removePending(index: number): void {
    URL.revokeObjectURL(this.filePreviews[index].url);
    this.pendingFiles.splice(index, 1);
    this.filePreviews.splice(index, 1);
  }

  upload(): void {
    if (!this.selectedProduct?.productId || this.pendingFiles.length === 0) return;
    const toUpload = [...this.pendingFiles];
    this.clearPending();
    toUpload.forEach(file => {
      this.uploadingCount++;
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      this.productService.uploadToCloudinary(file).subscribe({
        next: (res: any) => {
          this.productService.saveProductImage(
            this.selectedProduct!.productId!, res.secure_url, res.public_id, mediaType
          ).subscribe({
            next: (img) => { this.productImages.push(img); this.uploadingCount--; },
            error: () => { this.uploadingCount--; }
          });
        },
        error: () => { this.uploadingCount--; }
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

  private clearPending(): void {
    this.filePreviews.forEach(p => URL.revokeObjectURL(p.url));
    this.pendingFiles = [];
    this.filePreviews = [];
  }
}
