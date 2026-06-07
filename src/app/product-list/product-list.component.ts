import { Component, OnInit } from '@angular/core';
import JsBarcode from 'jsbarcode';
import { ProductService } from '../product.service';
import { Product, ProductImage } from '../product.model';
import { ProductCategory, ProductSubCategory } from '../product-category.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiPhotoWorkflowComponent } from '../ai-photo-workflow/ai-photo-workflow.component';
import { AuthService } from '../auth.service';
import { ThermalPrinterService } from '../thermal-printer.service';

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
  aiPhotoInitialFile: File | undefined = undefined;

  filteredSubCategories: ProductSubCategory[] = [];
  productImages: ProductImage[] = [];
  uploadingCount = 0;
  generatingDesc = false;
  printingLabel = false;
  newProductId: number | null = null;
  createdProductName: string = '';

  readonly availableTags = ['Casual', 'Formal', 'Party', 'Wedding', 'Festival', 'Traditional', 'Office', 'Bridal'];
  readonly availableUsages = ['Saree', 'Kurti', 'Dress', 'Frock', 'Blouse', 'Lehenga', 'Salwar', 'Dupatta', 'Kids Wear'];
  readonly standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

  constructor(
    private productService: ProductService,
    private auth: AuthService,
    public  printer: ThermalPrinterService,
  ) {}

  get isSales(): boolean { return this.auth.isSales(); }

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
      const term = this.searchTerm.trim().toLowerCase();
      const matchesSearch = !term ||
        product.productName.toLowerCase().includes(term) ||
        (product.productId != null && String(product.productId).includes(term)) ||
        (product.description && product.description.toLowerCase().includes(term));
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

  getSizeArray(product: Product): string[] {
    if (!product.sizes) return [];
    return product.sizes.split(',').map(s => s.trim()).filter(Boolean);
  }

  isSizeSelected(size: string): boolean {
    if (!this.selectedProduct?.sizes) return false;
    return this.selectedProduct.sizes.split(',').map(s => s.trim()).includes(size);
  }

  toggleSize(size: string): void {
    if (!this.selectedProduct) return;
    const current = this.selectedProduct.sizes
      ? this.selectedProduct.sizes.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const idx = current.indexOf(size);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(size);
    }
    this.selectedProduct.sizes = current.length > 0 ? current.join(',') : undefined;
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
      unit: 'MTS',
      isOnline: true,
      isActive: true,
      subCategory: undefined
    };
    this.filteredSubCategories = [];
    this.productImages = [];
  }

  cloneProduct(product: Product): void {
    this.selectedProduct = {
      productName: 'Copy of ' + product.productName,
      description: product.description,
      category: product.category,
      subCategory: product.subCategory,
      unit: product.unit,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      stockQuantity: 0,
      minStockLevel: product.minStockLevel,
      isActive: product.isActive,
      isOnline: product.isOnline,
      tags: product.tags,
      suitableFor: product.suitableFor,
      sizes: product.sizes
    };
    this.filteredSubCategories = [];
    this.productImages = [];
    const catName = product.category?.categoryName;
    if (catName) {
      this.productService.getSubCategories(catName).subscribe(data => {
        this.filteredSubCategories = data;
      });
    }
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
          this.newProductId = created.productId ?? null;
          this.createdProductName = created.productName;
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

  dismissCreatedPopup(): void {
    this.newProductId = null;
  }

  async printLabel(): Promise<void> {
    if (!this.selectedProduct?.productId || this.printingLabel) return;
    this.printingLabel = true;
    console.log('[PRINT-LABEL] triggered for product:', {
      productId: this.selectedProduct.productId,
      productName: this.selectedProduct.productName,
      sellingPrice: this.selectedProduct.sellingPrice,
      category: this.selectedProduct.category?.categoryName,
      labelConnected: this.printer.labelConnected,
      labelDeviceName: this.printer.labelDeviceName,
    });
    try {
      // Try DTPWeb SDK (SEZNIK JOSH / DothanTech via Windows service) or BLE label printer
      const dtpAvailable = await this.printer.isDtpWebAvailable();
      console.log('[PRINT-LABEL] dtpWebAvailable:', dtpAvailable,
        '| labelConnected:', this.printer.labelConnected);

      if (dtpAvailable || this.printer.labelConnected || await this.printer.reconnectLabel()) {
        console.log('[PRINT-LABEL] label printer available (dtp=%s ble=%s) — sending print job',
          dtpAvailable, this.printer.labelConnected);
        const ok = await this.printer.printLabel(this.selectedProduct);
        console.log('[PRINT-LABEL] printLabel result:', ok);
        if (ok) return;
        console.warn('[PRINT-LABEL] printLabel returned false — falling through to QZ Tray');
      } else {
        console.warn('[PRINT-LABEL] No label printer available (no DTPWeb, no BLE) — falling through to QZ Tray');
      }

      // Fall back to QZ Tray (USB / network label printer)
      const productCode = String(this.selectedProduct.productId).padStart(6, '0');
      const barcodeDataUrl = this.generateBarcodeDataUrl(productCode);
      const html = this.buildLabelHtml(productCode, barcodeDataUrl);

      const qz = await this.loadQzTray();
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({ retries: 2, delay: 500 });
      }
      const qzPrinter = await qz.printers.getDefault();
      const config = qz.configs.create(qzPrinter, {
        size: { width: 2, height: 1 },
        units: 'in',
        scaleContent: false,
        margins: 0,
        colorType: 'blackwhite'
      });
      await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (/unable to establish|websocket|connect/i.test(msg)) {
        alert(
          'No label printer connected.\n\n' +
          'Option 1 — SEZNIK JOSH / DothanTech printer:\n' +
          '1. Install DTPWeb-Inst on this Windows PC (provided with printer)\n' +
          '2. Start the DTPWeb service\n' +
          '3. Click "Print Label" again\n\n' +
          'Option 2 — Bluetooth: Go to Settings → Label Printer and pair your BLE label printer.\n\n' +
          'Option 3 — QZ Tray (USB/network):\n' +
          '1. Download and install QZ Tray from qz.io\n' +
          '2. Start QZ Tray (runs in system tray)\n' +
          '3. Click "Print Label" again'
        );
      } else {
        alert('Print failed: ' + msg);
      }
    } finally {
      this.printingLabel = false;
    }
  }

  private generateBarcodeDataUrl(code: string): string {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, code, {
      format: 'CODE128',
      width: 1.5,
      height: 28,
      displayValue: false,
      margin: 2,
      background: '#ffffff'
    });
    return canvas.toDataURL('image/png');
  }

  private buildLabelHtml(productCode: string, barcodeDataUrl: string): string {
    const p = this.selectedProduct!;
    const safeName = (p.productName ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const price = p.sellingPrice != null ? Number(p.sellingPrice).toFixed(2) : '0.00';
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: 2in 1in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; width: 2in; height: 1in; overflow: hidden; background: #fff; }
  .lbl { width: 2in; height: 1in; padding: 4px 6px; display: flex; flex-direction: column; justify-content: space-between; }
  .name { font-size: 8pt; font-weight: bold; line-height: 1.2; overflow: hidden; max-height: 20pt; }
  .bc { display: flex; justify-content: center; }
  .bc img { height: 28px; max-width: 100%; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; }
  .code { font-size: 6.5pt; color: #333; }
  .price { font-size: 9.5pt; font-weight: bold; }
</style>
</head><body>
<div class="lbl">
  <div class="name">${safeName}</div>
  <div class="bc"><img src="${barcodeDataUrl}" alt=""></div>
  <div class="foot">
    <span class="code">Code: ${productCode}</span>
    <span class="price">&#8377;${price}</span>
  </div>
</div>
</body></html>`;
  }

  private loadQzTray(): Promise<any> {
    return new Promise((resolve, reject) => {
      const w = window as any;
      if (w.qz?.websocket) { resolve(w.qz); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
      script.onload = () => {
        const qz = (window as any).qz;
        qz?.websocket ? resolve(qz) : reject(new Error('QZ Tray script loaded but qz object missing'));
      };
      script.onerror = () => reject(new Error('Unable to establish connection — QZ Tray is not running'));
      document.head.appendChild(script);
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
      if (file.type.startsWith('image/')) {
        // Route image uploads through the AI photo workflow
        this.openAIPhotoWorkflow(this.selectedProduct!, file);
      } else {
        // Videos upload directly to Cloudinary
        this.uploadingCount++;
        this.productService.uploadToCloudinary(file).subscribe({
          next: (res: any) => {
            const productId = this.selectedProduct?.productId;
            if (!productId) { this.uploadingCount--; return; }
            this.productService.saveProductImage(productId, res.secure_url, res.public_id, 'video').subscribe({
              next: (img) => { this.productImages.push(img); this.uploadingCount--; },
              error: (err) => { alert('File saved but DB failed: ' + (err.error?.message || err.message)); this.uploadingCount--; }
            });
          },
          error: () => { alert('Failed to upload video. Please try again.'); this.uploadingCount--; }
        });
      }
    });
  }

  deleteImage(img: ProductImage): void {
    if (!this.selectedProduct?.productId || !img.imageId) return;
    this.productService.deleteProductImage(this.selectedProduct.productId, img.imageId).subscribe(() => {
      this.productImages = this.productImages.filter(i => i.imageId !== img.imageId);
    });
  }

  get isUploading(): boolean { return this.uploadingCount > 0; }

  openAIPhotoWorkflow(product: Product, initialFile?: File): void {
    this.aiPhotoProduct = product;
    this.aiPhotoInitialFile = initialFile;
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
    this.aiPhotoInitialFile = undefined;
  }
}
