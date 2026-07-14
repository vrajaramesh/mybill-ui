import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductService } from '../product.service';
import { Product, ProductImage } from '../product.model';
import { AiGenerationPrompt } from '../ai-config/ai-config.component';
import { ThermalPrinterService } from '../thermal-printer.service';
import { AuthService } from '../auth.service';
import JsBarcode from 'jsbarcode';

export type CoverageStatus = 'none' | 'partial' | 'good';

export interface ProductCoverageRow {
  product: Product;
  images: ProductImage[];
  imageCount: number;
  garments: string[];
  garmentCount: number;
  status: CoverageStatus;
  loaded: boolean;
}

type FilterTab = 'all' | 'none' | 'partial' | 'good';

@Component({
  selector: 'app-ecom-coverage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ecom-coverage.component.html',
  styleUrl: './ecom-coverage.component.css'
})
export class EcomCoverageComponent implements OnInit {
  rows: ProductCoverageRow[] = [];
  filteredRows: ProductCoverageRow[] = [];

  loadingProducts = false;
  loadingImages = false;
  loadedCount = 0;
  totalToLoad = 0;

  searchQuery = '';
  activeTab: FilterTab = 'all';
  expandedProductId: number | null = null;

  // Prompts (loaded once, used for copy-prompt feature)
  prompts: AiGenerationPrompt[] = [];

  // Prompt modal state (one at a time, per-garment)
  promptModal: {
    garment: string;
    text: string;
    editing: boolean;
    copied: boolean;
  } | null = null;

  // Drag-and-drop state
  dragSrcRow: ProductCoverageRow | null = null;
  dragSrcIdx: number = -1;
  dragOverIdx: number = -1;

  // Copy feedback per-image
  copiedToast = '';

  // Print state
  printingId: number | null = null;

  // Facebook publish state per product: 'publishing' | 'success' | 'error'
  fbPublishState: Record<number, string> = {};

  // Upload state
  uploadPanel: {
    row: ProductCoverageRow;
    garment: string;
    file: File | null;
    previewUrl: string;
    uploading: boolean;
    error: string;
  } | null = null;

  // Clone state
  clonePanel: {
    row: ProductCoverageRow;
    productName: string;
    stockQuantity: number | null;
    saving: boolean;
    error: string;
    success: string;
  } | null = null;

  constructor(
    private productService: ProductService,
    private http: HttpClient,
    private printer: ThermalPrinterService,
    private authService: AuthService
  ) {}

  get isEcom(): boolean { return this.authService.isEcom(); }

  ngOnInit(): void {
    this.loadData();
    this.loadPrompts();
  }

  loadData(): void {
    this.loadingProducts = true;
    this.rows = [];
    this.filteredRows = [];

    this.productService.getProducts().subscribe({
      next: (products) => {
        this.loadingProducts = false;
        const qualifying = products.filter(
          p => (p.stockQuantity ?? 0) > 0 && p.isOnline === true
        );
        this.rows = qualifying.map(p => this.makeRow(p));
        this.applyFilter();
        this.fetchImageCounts();
      },
      error: () => { this.loadingProducts = false; }
    });
  }

  loadPrompts(): void {
    this.http.get<AiGenerationPrompt[]>('/api/ai-config/prompts').subscribe({
      next: data => this.prompts = data,
      error: () => {}
    });
  }

  private makeRow(p: Product): ProductCoverageRow {
    const garments = p.suitableFor
      ? p.suitableFor.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    return {
      product: p,
      images: [],
      imageCount: 0,
      garments,
      garmentCount: garments.length,
      status: 'none',
      loaded: false,
    };
  }

  private fetchImageCounts(): void {
    const unloaded = this.rows.filter(r => r.product.productId);
    if (!unloaded.length) return;

    this.loadingImages = true;
    this.loadedCount = 0;
    this.totalToLoad = unloaded.length;

    const BATCH = 10;
    const batches: ProductCoverageRow[][] = [];
    for (let i = 0; i < unloaded.length; i += BATCH) {
      batches.push(unloaded.slice(i, i + BATCH));
    }

    const runBatch = (idx: number) => {
      if (idx >= batches.length) {
        this.loadingImages = false;
        this.applyFilter();
        return;
      }
      const batch = batches[idx];
      const requests = batch.map(r =>
        this.productService.getProductImages(r.product.productId!).pipe(catchError(() => of([])))
      );
      forkJoin(requests).subscribe(results => {
        results.forEach((imgs, i) => {
          const images = imgs as ProductImage[];
          batch[i].images = images;
          batch[i].imageCount = images.filter(img => img.mediaType !== 'video').length;
          batch[i].status = this.calcStatus(batch[i]);
          batch[i].loaded = true;
          this.loadedCount++;
        });
        this.applyFilter();
        runBatch(idx + 1);
      });
    };
    runBatch(0);
  }

  private calcStatus(row: ProductCoverageRow): CoverageStatus {
    if (row.imageCount === 0) return 'none';
    const needed = row.garmentCount > 0 ? row.garmentCount + 1 : 1;
    if (row.imageCount >= needed) return 'good';
    return 'partial';
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredRows = this.rows.filter(r => {
      const matchTab =
        this.activeTab === 'all' ||
        (this.activeTab === 'none'    && r.status === 'none') ||
        (this.activeTab === 'partial' && r.status === 'partial') ||
        (this.activeTab === 'good'    && r.status === 'good');
      const matchSearch = !q ||
        r.product.productName.toLowerCase().includes(q) ||
        String(r.product.productId).includes(q) ||
        (r.product.category?.categoryName || '').toLowerCase().includes(q) ||
        (r.product.suitableFor || '').toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }

  setTab(tab: FilterTab): void {
    this.activeTab = tab;
    this.applyFilter();
  }

  onSearch(): void {
    this.applyFilter();
  }

  toggleExpand(row: ProductCoverageRow): void {
    const id = row.product.productId!;
    if (this.expandedProductId === id) {
      this.expandedProductId = null;
      this.promptModal = null;
      this.closeUploadPanel();
      this.closeClonePanel();
    } else {
      this.expandedProductId = id;
      this.promptModal = null;
      this.closeUploadPanel();
      this.closeClonePanel();
    }
  }

  // ── Upload panel ────────────────────────────────────────────────────────────

  garmentOptionsFor(row: ProductCoverageRow): string[] {
    return ['Flat Fabric', ...row.garments];
  }

  openUploadPanel(row: ProductCoverageRow): void {
    this.promptModal = null;
    this.closeClonePanel();
    this.uploadPanel = {
      row,
      garment: this.garmentOptionsFor(row)[0],
      file: null,
      previewUrl: '',
      uploading: false,
      error: '',
    };
  }

  closeUploadPanel(): void {
    if (this.uploadPanel?.previewUrl) {
      URL.revokeObjectURL(this.uploadPanel.previewUrl);
    }
    this.uploadPanel = null;
  }

  onUploadFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.uploadPanel) return;

    if (this.uploadPanel.previewUrl) URL.revokeObjectURL(this.uploadPanel.previewUrl);
    this.uploadPanel.file = file;
    this.uploadPanel.previewUrl = URL.createObjectURL(file);
    this.uploadPanel.error = '';
  }

  submitUpload(): void {
    const panel = this.uploadPanel;
    if (!panel || !panel.file) return;

    panel.uploading = true;
    panel.error = '';

    this.productService.uploadToCloudinary(panel.file).subscribe({
      next: (res: any) => {
        const imageUrl: string = res.secure_url;
        const publicId: string = res.public_id || '';

        // Use HTTP directly so we can pass imageType (garment tag)
        this.http.post<ProductImage>(
          `/api/products/${panel.row.product.productId}/images`,
          { imageUrl, publicId, imageType: panel.garment, mediaType: 'image' }
        ).subscribe({
          next: (saved) => {
            panel.row.images.push(saved);
            panel.row.imageCount = panel.row.images.filter(i => i.mediaType !== 'video').length;
            panel.row.status = this.calcStatus(panel.row);
            this.applyFilter();
            panel.uploading = false;
            this.closeUploadPanel();
          },
          error: () => {
            panel.uploading = false;
            panel.error = 'Failed to save image. Please try again.';
          }
        });
      },
      error: () => {
        panel.uploading = false;
        panel.error = 'Cloudinary upload failed. Please try again.';
      }
    });
  }

  // ── Print label ─────────────────────────────────────────────────────────────

  async printLabel(row: ProductCoverageRow, event: Event): Promise<void> {
    event.stopPropagation();
    const id = row.product.productId!;
    if (this.printingId === id) return;
    this.printingId = id;
    try {
      const dtpAvailable = await this.printer.isDtpWebAvailable();
      if (dtpAvailable || this.printer.labelConnected || await this.printer.reconnectLabel()) {
        const ok = await this.printer.printLabel(row.product);
        if (ok) return;
      }
      // QZ Tray fallback
      const code = String(row.product.productId).padStart(6, '0');
      const barcodeDataUrl = this._generateBarcodeDataUrl(code);
      const html = this._buildLabelHtml(row.product, code, barcodeDataUrl);
      const qz = await this._loadQzTray();
      if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 2, delay: 500 });
      const qzPrinter = await qz.printers.getDefault();
      const config = qz.configs.create(qzPrinter, {
        size: { width: 2, height: 1 }, units: 'in', scaleContent: false, margins: 0, colorType: 'blackwhite'
      });
      await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (/unable to establish|websocket|connect/i.test(msg)) {
        alert(
          'No label printer connected.\n\n' +
          'Option 1 — SEZNIK JOSH / DothanTech printer:\n' +
          '  Install and start DTPWeb-Inst service on this PC.\n\n' +
          'Option 2 — Bluetooth:\n' +
          '  Go to Settings → Label Printer and pair your BLE label printer.\n\n' +
          'Option 3 — QZ Tray (USB/network):\n' +
          '  Download and start QZ Tray from qz.io.'
        );
      } else {
        alert('Print failed: ' + msg);
      }
    } finally {
      this.printingId = null;
    }
  }

  private _generateBarcodeDataUrl(code: string): string {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, code, { format: 'CODE128', width: 1.5, height: 28, displayValue: false, margin: 2, background: '#ffffff' });
    return canvas.toDataURL('image/png');
  }

  private _buildLabelHtml(product: Product, code: string, barcodeDataUrl: string): string {
    const name = (product.productName || '').substring(0, 22);
    const price = product.sellingPrice != null ? 'Rs.' + Number(product.sellingPrice).toFixed(0) : '';
    return `<div style="font-family:Arial;width:2in;height:1in;padding:2px;box-sizing:border-box;overflow:hidden">
      <div style="font-size:7pt;font-weight:bold;text-align:center">${name}</div>
      <img src="${barcodeDataUrl}" style="width:100%;height:28px">
      <div style="font-size:6pt;text-align:center">${code}</div>
      <div style="font-size:9pt;font-weight:bold;text-align:center">${price}</div>
    </div>`;
  }

  private _loadQzTray(): Promise<any> {
    return new Promise((resolve, reject) => {
      const w = window as any;
      if (w.qz) { resolve(w.qz); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
      script.onload = () => w.qz ? resolve(w.qz) : reject(new Error('QZ Tray script loaded but qz not found'));
      script.onerror = () => reject(new Error('Failed to load QZ Tray script'));
      document.head.appendChild(script);
    });
  }

  // ── Clone product ───────────────────────────────────────────────────────────

  openClonePanel(row: ProductCoverageRow): void {
    this.promptModal = null;
    this.closeUploadPanel();
    this.clonePanel = {
      row,
      productName: row.product.productName + ' (Copy)',
      stockQuantity: null,
      saving: false,
      error: '',
      success: '',
    };
  }

  closeClonePanel(): void {
    this.clonePanel = null;
  }

  submitClone(): void {
    const panel = this.clonePanel;
    if (!panel) return;
    if (!panel.productName.trim()) {
      panel.error = 'Product name is required.';
      return;
    }
    if (panel.stockQuantity === null || panel.stockQuantity < 0) {
      panel.error = 'Enter a valid stock quantity (0 or more).';
      return;
    }

    panel.saving = true;
    panel.error = '';

    const src = panel.row.product;
    const newProduct = {
      productName: panel.productName.trim(),
      description: src.description,
      category: src.category,
      subCategory: src.subCategory,
      unit: src.unit,
      costPrice: src.costPrice,
      sellingPrice: src.sellingPrice,
      stockQuantity: panel.stockQuantity,
      minStockLevel: src.minStockLevel,
      isActive: src.isActive ?? true,
      isOnline: src.isOnline ?? true,
      tags: src.tags,
      suitableFor: src.suitableFor,
      sizes: src.sizes,
    };

    this.productService.createProduct(newProduct as any).subscribe({
      next: (saved) => {
        panel.saving = false;
        panel.success = `Created "#${saved.productId} ${saved.productName}" successfully.`;
        // Add to rows list so it appears in the table immediately
        const newRow = this.makeRow(saved);
        newRow.loaded = true;
        newRow.status = 'none';
        this.rows.push(newRow);
        this.applyFilter();
      },
      error: (err) => {
        panel.saving = false;
        panel.error = err.error?.error || 'Failed to create product. Please try again.';
      }
    });
  }

  // ── Summary counts ──────────────────────────────────────────────────────────

  get totalCount(): number      { return this.rows.length; }
  get noneCount(): number       { return this.rows.filter(r => r.status === 'none').length; }
  get partialCount(): number    { return this.rows.filter(r => r.status === 'partial').length; }
  get goodCount(): number       { return this.rows.filter(r => r.status === 'good').length; }
  get totalImageCount(): number { return this.rows.reduce((sum, r) => sum + r.imageCount, 0); }

  get progressPct(): number {
    return this.totalToLoad ? Math.round(this.loadedCount / this.totalToLoad * 100) : 0;
  }

  statusLabel(s: CoverageStatus): string {
    if (s === 'none')    return 'No Images';
    if (s === 'partial') return 'Partial';
    return 'Complete';
  }

  imageNeeded(row: ProductCoverageRow): number {
    if (!row.loaded) return 0;
    const needed = row.garmentCount > 0 ? row.garmentCount + 1 : 1;
    return Math.max(0, needed - row.imageCount);
  }

  // ── Facebook / Instagram Shop publish ───────────────────────────────────────

  publishToFacebook(row: ProductCoverageRow): void {
    const id = row.product.productId!;
    if (this.fbPublishState[id] === 'publishing') return;
    this.fbPublishState[id] = 'publishing';

    this.http.post<any>(`/api/facebook/catalog/publish/${id}`, {}).subscribe({
      next: () => {
        this.fbPublishState[id] = 'success';
        setTimeout(() => {
          if (this.fbPublishState[id] === 'success') delete this.fbPublishState[id];
        }, 5000);
      },
      error: (err) => {
        this.fbPublishState[id] = 'error';
        const msg = err?.error?.error || 'Failed to publish to Facebook catalog';
        alert(msg);
        setTimeout(() => {
          if (this.fbPublishState[id] === 'error') delete this.fbPublishState[id];
        }, 5000);
      }
    });
  }

  // ── Delete image ────────────────────────────────────────────────────────────

  deleteImage(row: ProductCoverageRow, img: ProductImage): void {
    if (!confirm('Delete this image?')) return;
    this.productService.deleteProductImage(row.product.productId!, img.imageId!).subscribe({
      next: () => {
        row.images = row.images.filter(i => i.imageId !== img.imageId);
        row.imageCount = row.images.filter(i => i.mediaType !== 'video').length;
        row.status = this.calcStatus(row);
        this.applyFilter();
      },
      error: () => alert('Failed to delete image')
    });
  }

  // ── Download image ──────────────────────────────────────────────────────────

  downloadImage(url: string, productName: string): void {
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${productName.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => window.open(url, '_blank'));
  }

  // ── Prompt modal ────────────────────────────────────────────────────────────

  openPromptModal(garment: string): void {
    const match = this.prompts.find(p =>
      p.suitableFor.toLowerCase() === garment.toLowerCase()
    );
    this.promptModal = {
      garment,
      text: match?.prompt || `Generate a photorealistic image of the fabric made into a ${garment}.`,
      editing: false,
      copied: false,
    };
  }

  closePromptModal(): void {
    this.promptModal = null;
  }

  copyPrompt(): void {
    if (!this.promptModal) return;
    navigator.clipboard.writeText(this.promptModal.text).then(() => {
      this.promptModal!.copied = true;
      setTimeout(() => { if (this.promptModal) this.promptModal.copied = false; }, 2000);
    });
  }

  // ── Drag-and-drop reorder ───────────────────────────────────────────────────

  onDragStart(row: ProductCoverageRow, idx: number, event: DragEvent): void {
    this.dragSrcRow = row;
    this.dragSrcIdx = idx;
    this.dragOverIdx = idx;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(idx: number, event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverIdx = idx;
  }

  onDragLeave(): void {
    // keep dragOverIdx so highlight persists while over the zone
  }

  onDrop(row: ProductCoverageRow, toIdx: number, event: DragEvent): void {
    event.preventDefault();
    if (!this.dragSrcRow || this.dragSrcRow !== row) return;
    const fromIdx = this.dragSrcIdx;
    if (fromIdx === toIdx) return;

    const imgs = [...row.images];
    const [moved] = imgs.splice(fromIdx, 1);
    imgs.splice(toIdx, 0, moved);
    row.images = imgs;

    this.dragSrcRow = null;
    this.dragSrcIdx = -1;
    this.dragOverIdx = -1;

    // Persist new order
    const order = imgs.map((img, i) => ({ imageId: img.imageId!, sortOrder: i }));
    this.productService.reorderProductImages(row.product.productId!, order).subscribe();
  }

  onDragEnd(): void {
    this.dragSrcRow = null;
    this.dragSrcIdx = -1;
    this.dragOverIdx = -1;
  }
}
