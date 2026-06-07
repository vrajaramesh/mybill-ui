import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ProductService } from '../product.service';
import { Product } from '../product.model';

export interface AiGenerationPrompt {
  id?: number;
  category?: string;
  suitableFor: string;
  prompt: string;
}

export interface ProductModelConfig {
  id?: number;
  garmentType: string;
  modelName?: string;
  modelImageUrl: string;
}

type Tab = 'prompts' | 'models' | 'firm-map';

@Component({
  selector: 'app-ai-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-config.component.html',
  styleUrl: './ai-config.component.css'
})
export class AiConfigComponent implements OnInit {
  activeTab: Tab = 'prompts';

  // ── Prompts ──────────────────────────────────────────────────────────────
  prompts: AiGenerationPrompt[] = [];
  showPromptForm = false;
  editingPrompt: AiGenerationPrompt | null = null;
  promptForm: AiGenerationPrompt = { suitableFor: '', prompt: '' };
  promptError = '';
  promptSaving = false;

  // ── Models ───────────────────────────────────────────────────────────────
  models: ProductModelConfig[] = [];
  showModelForm = false;
  editingModel: ProductModelConfig | null = null;
  modelForm: ProductModelConfig = { garmentType: '', modelName: '', modelImageUrl: '' };
  modelError = '';
  modelSaving = false;
  modelPreviewUrl = '';
  modelUploading = false;

  // ── Firm Image Map ────────────────────────────────────────────────────────
  sourceFirmCode = 'srihitha';
  sourceProducts: Product[] = [];
  sourceProductId: number | null = null;
  sourceSearchTerm = '';
  targetProducts: Product[] = [];
  targetProductId: number | null = null;
  targetSearchTerm = '';
  firmMapError = '';
  firmMapSuccess = '';
  firmMapBusy = false;

  readonly garmentOptions = ['Fabric', 'Saree', 'Kurti', 'Dress', 'Frock', 'Blouse', 'Lehenga', 'Salwar', 'Dupatta', 'Kids Wear'];

  constructor(private http: HttpClient, private productService: ProductService) {}

  ngOnInit(): void {
    this.loadPrompts();
    this.loadModels();
    this.loadTargetProducts();
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
  }

  // ── Prompts CRUD ──────────────────────────────────────────────────────────

  loadPrompts(): void {
    this.http.get<AiGenerationPrompt[]>('/api/ai-config/prompts').subscribe({
      next: data => this.prompts = data,
      error: () => this.promptError = 'Failed to load prompts'
    });
  }

  startAddPrompt(): void {
    this.editingPrompt = null;
    this.promptForm = { suitableFor: '', prompt: '' };
    this.promptError = '';
    this.showPromptForm = true;
  }

  startEditPrompt(p: AiGenerationPrompt): void {
    this.editingPrompt = p;
    this.promptForm = { ...p };
    this.promptError = '';
    this.showPromptForm = true;
  }

  savePrompt(): void {
    if (!this.promptForm.suitableFor || !this.promptForm.prompt) {
      this.promptError = 'Suitable For and Prompt are required.';
      return;
    }
    this.promptSaving = true;
    this.promptError = '';
    const req = this.editingPrompt?.id
      ? this.http.put<AiGenerationPrompt>(`/api/ai-config/prompts/${this.editingPrompt.id}`, this.promptForm)
      : this.http.post<AiGenerationPrompt>('/api/ai-config/prompts', this.promptForm);

    req.subscribe({
      next: () => { this.promptSaving = false; this.showPromptForm = false; this.editingPrompt = null; this.loadPrompts(); },
      error: err => { this.promptSaving = false; this.promptError = err.error?.error || 'Save failed'; }
    });
  }

  deletePrompt(p: AiGenerationPrompt): void {
    if (!confirm(`Delete prompt for "${p.suitableFor}"?`)) return;
    this.http.delete(`/api/ai-config/prompts/${p.id}`).subscribe({
      next: () => this.loadPrompts(),
      error: () => alert('Delete failed')
    });
  }

  cancelPrompt(): void {
    this.showPromptForm = false;
    this.editingPrompt = null;
    this.promptForm = { suitableFor: '', prompt: '' };
    this.promptError = '';
  }

  // ── Models CRUD ───────────────────────────────────────────────────────────

  loadModels(): void {
    this.http.get<ProductModelConfig[]>('/api/ai-config/models').subscribe({
      next: data => this.models = data,
      error: () => this.modelError = 'Failed to load models'
    });
  }

  startAddModel(): void {
    this.editingModel = null;
    this.modelForm = { garmentType: '', modelName: '', modelImageUrl: '' };
    this.modelPreviewUrl = '';
    this.modelError = '';
    this.modelUploading = false;
    this.showModelForm = true;
  }

  startEditModel(m: ProductModelConfig): void {
    this.editingModel = m;
    this.modelForm = { ...m };
    this.modelPreviewUrl = m.modelImageUrl;
    this.modelError = '';
    this.modelUploading = false;
    this.showModelForm = true;
  }

  onModelImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    // Show local preview immediately while uploading
    const reader = new FileReader();
    reader.onload = () => { this.modelPreviewUrl = reader.result as string; };
    reader.readAsDataURL(file);

    this.modelUploading = true;
    this.modelError = '';
    const formData = new FormData();
    formData.append('file', file);
    this.http.post<{ secure_url: string }>('/api/upload/image', formData).subscribe({
      next: res => {
        this.modelForm.modelImageUrl = res.secure_url;
        this.modelPreviewUrl = res.secure_url;
        this.modelUploading = false;
      },
      error: () => {
        this.modelError = 'Image upload failed. Please try again.';
        this.modelPreviewUrl = '';
        this.modelUploading = false;
      }
    });
  }

  saveModel(): void {
    if (!this.modelForm.garmentType) {
      this.modelError = 'Garment Type is required.';
      return;
    }
    if (!this.modelForm.modelImageUrl) {
      this.modelError = 'Please upload a model image first.';
      return;
    }
    if (this.modelUploading) {
      this.modelError = 'Please wait for the image to finish uploading.';
      return;
    }
    this.modelSaving = true;
    this.modelError = '';
    const req = this.editingModel?.id
      ? this.http.put<ProductModelConfig>(`/api/ai-config/models/${this.editingModel.id}`, this.modelForm)
      : this.http.post<ProductModelConfig>('/api/ai-config/models', this.modelForm);

    req.subscribe({
      next: () => { this.modelSaving = false; this.showModelForm = false; this.editingModel = null; this.modelPreviewUrl = ''; this.loadModels(); },
      error: err => { this.modelSaving = false; this.modelError = err.error?.error || 'Save failed'; }
    });
  }

  deleteModel(m: ProductModelConfig): void {
    if (!confirm(`Delete model config for "${m.garmentType}"?`)) return;
    this.http.delete(`/api/ai-config/models/${m.id}`).subscribe({
      next: () => this.loadModels(),
      error: () => alert('Delete failed')
    });
  }

  cancelModel(): void {
    this.showModelForm = false;
    this.editingModel = null;
    this.modelForm = { garmentType: '', modelName: '', modelImageUrl: '' };
    this.modelPreviewUrl = '';
    this.modelError = '';
    this.modelUploading = false;
  }

  // ── Firm Image Map ────────────────────────────────────────────────────────

  loadTargetProducts(): void {
    this.productService.getProducts().subscribe(p => this.targetProducts = p);
  }

  loadSourceProducts(): void {
    this.sourceProducts = [];
    this.sourceProductId = null;
    this.firmMapError = '';
    this.http.get<Product[]>(`/api/ai-config/firm-products?firmCode=${this.sourceFirmCode}`).subscribe({
      next: data => this.sourceProducts = data,
      error: err => this.firmMapError = err.error?.error || 'Failed to load source firm products'
    });
  }

  get filteredSourceProducts(): Product[] {
    const q = this.sourceSearchTerm.toLowerCase();
    return q ? this.sourceProducts.filter(p =>
      p.productName.toLowerCase().includes(q) || String(p.productId).includes(q)
    ) : this.sourceProducts;
  }

  get filteredTargetProducts(): Product[] {
    const q = this.targetSearchTerm.toLowerCase();
    return q ? this.targetProducts.filter(p =>
      p.productName.toLowerCase().includes(q) || String(p.productId).includes(q)
    ) : this.targetProducts;
  }

  copyImages(): void {
    if (!this.sourceProductId || !this.targetProductId) {
      this.firmMapError = 'Select both source and target products.';
      return;
    }
    this.firmMapBusy = true;
    this.firmMapError = '';
    this.firmMapSuccess = '';
    this.http.post<any>('/api/ai-config/copy-firm-images', {
      sourceFirmCode: this.sourceFirmCode,
      sourceProductId: this.sourceProductId,
      targetProductId: this.targetProductId
    }).subscribe({
      next: res => {
        this.firmMapBusy = false;
        this.firmMapSuccess = res.message || `${res.copied} image(s) copied successfully.`;
      },
      error: err => {
        this.firmMapBusy = false;
        this.firmMapError = err.error?.error || 'Copy failed';
      }
    });
  }
}
