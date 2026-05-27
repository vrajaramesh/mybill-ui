import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../product.service';
import { Product } from '../product.model';

type Stage = 'upload' | 'analyzing' | 'generating' | 'review' | 'saving' | 'done';

@Component({
  selector: 'app-ai-photo-workflow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-photo-workflow.component.html',
  styleUrl: './ai-photo-workflow.component.css'
})
export class AiPhotoWorkflowComponent {
  @Input() product!: Product;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  stage: Stage = 'upload';
  errorMsg = '';
  generatedUrls: string[] = [];
  orderedUrls: string[] = [];
  dragFromIndex: number | null = null;

  constructor(private productService: ProductService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.startGeneration(file);
  }

  private startGeneration(file: File): void {
    this.errorMsg = '';
    this.stage = 'analyzing';

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl  = reader.result as string;
      const parts    = dataUrl.split(',');
      const mimeType = parts[0].replace('data:', '').replace(';base64', '');
      const base64   = parts[1];

      this.stage = 'generating';

      this.productService.generateAIPhotos(this.product.productId!, base64, mimeType).subscribe({
        next: urls => {
          this.generatedUrls = urls;
          this.orderedUrls   = [...urls];
          this.stage = 'review';
        },
        error: err => {
          const body = err.error;
          this.errorMsg = (typeof body === 'string' ? body : (body?.error || body?.message))
            || err.message
            || 'Generation failed. Please try again.';
          this.stage = 'upload';
        }
      });
    };
    reader.readAsDataURL(file);
  }

  // ── Drag-and-drop reorder ────────────────────────────────────────────────

  onDragStart(index: number): void {
    this.dragFromIndex = index;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(toIndex: number): void {
    if (this.dragFromIndex === null || this.dragFromIndex === toIndex) return;
    const arr  = [...this.orderedUrls];
    const item = arr.splice(this.dragFromIndex, 1)[0];
    arr.splice(toIndex, 0, item);
    this.orderedUrls   = arr;
    this.dragFromIndex = null;
  }

  // ── Save ────────────────────────────────────────────────────────────────

  save(): void {
    this.stage = 'saving';
    this.productService.saveAIPhotos(this.product.productId!, this.orderedUrls).subscribe({
      next: () => {
        this.stage = 'done';
        setTimeout(() => {
          this.saved.emit();
          this.close.emit();
        }, 1500);
      },
      error: err => {
        this.errorMsg = err.error?.message || err.message || 'Save failed.';
        this.stage = 'review';
      }
    });
  }

  regenerate(): void {
    this.stage = 'upload';
    this.generatedUrls = [];
    this.orderedUrls   = [];
    this.errorMsg = '';
  }

  photoLabel(index: number): string {
    const labels = ['Display Shot', 'Day Wear', 'Evening Look', 'Detail Close-up'];
    return labels[index] ?? `Photo ${index + 1}`;
  }

  dismiss(): void {
    this.close.emit();
  }
}
