import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../product.service';
import { Product } from '../product.model';

type Stage = 'upload' | 'generating' | 'done';

@Component({
  selector: 'app-ai-photo-workflow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-photo-workflow.component.html',
  styleUrl: './ai-photo-workflow.component.css'
})
export class AiPhotoWorkflowComponent implements OnInit {
  @Input() product!: Product;
  /** When set, the workflow skips the upload step and starts generating immediately. */
  @Input() initialFile?: File;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  stage: Stage = 'upload';
  errorMsg = '';

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    if (this.initialFile) {
      this.startGeneration(this.initialFile);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.startGeneration(file);
  }

  private startGeneration(file: File): void {
    this.errorMsg = '';

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl  = reader.result as string;
      const parts    = dataUrl.split(',');
      const mimeType = parts[0].replace('data:', '').replace(';base64', '');
      const base64   = parts[1];

      // Fire and forget — don't hold the dialog open waiting for backend.
      // Backend generates asynchronously; photos auto-save to the product gallery.
      this.productService.generateAIPhotos(this.product.productId!, base64, mimeType)
        .subscribe({ error: err => console.warn('[AI-PHOTO] Background request error:', err) });
    };
    reader.readAsDataURL(file);

    // Show success and close immediately — no waiting
    this.stage = 'done';
    setTimeout(() => {
      this.saved.emit();
      this.close.emit();
    }, 1500);
  }

  dismiss(): void {
    this.close.emit();
  }
}
