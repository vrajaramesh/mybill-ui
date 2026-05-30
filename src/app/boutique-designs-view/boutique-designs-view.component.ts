import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoutiqueService } from '../boutique.service';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface DesignImage { id: number; imageUrl: string; publicId: string; }

@Component({
  selector: 'app-boutique-designs-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './boutique-designs-view.component.html',
  styleUrl: './boutique-designs-view.component.css'
})
export class BoutiqueDesignsViewComponent implements OnInit {

  designs: any[] = [];
  loading = false;
  showForm = false;
  saving = false;
  uploading = false;
  editingId: number | null = null;

  form: { garmentType: string; description: string; roughPrice: number | null; deliveryDays: number | null } =
    { garmentType: '', description: '', roughPrice: null, deliveryDays: null };

  // Images managed in the form
  formImages: { id: number; imageUrl: string; publicId: string; pending?: boolean }[] = [];
  deletedImageIds: number[] = [];

  readonly garmentTypes = [
    'Blouse','Skirt','Frock','Salwar','Kurta','Kurti','Lehenga','Choli',
    'Anarkali','Palazzo','Suit','Shirt','Trouser','Saree Fall','Other'
  ];

  constructor(private svc: BoutiqueService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.getDesigns().subscribe({
      next: d => { this.designs = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openForm(d?: any) {
    if (d) {
      this.editingId = d.designId;
      this.form = {
        garmentType:  d.garmentType,
        description:  d.description || '',
        roughPrice:   d.roughPrice,
        deliveryDays: d.deliveryDays
      };
      // Populate images from design (images array from API)
      this.formImages = (d.images || []).map((img: DesignImage) => ({
        id: img.id, imageUrl: img.imageUrl, publicId: img.publicId || ''
      }));
    } else {
      this.editingId = null;
      this.form = { garmentType: '', description: '', roughPrice: null, deliveryDays: null };
      this.formImages = [];
    }
    this.deletedImageIds = [];
    this.showForm = true;
  }

  closeForm() { this.showForm = false; }

  onImagePick(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.svc.uploadToCloudinary(file).subscribe({
      next: (res: any) => {
        this.formImages.push({ id: 0, imageUrl: res.secure_url, publicId: res.public_id, pending: true });
        this.uploading = false;
      },
      error: () => { this.uploading = false; }
    });
    // Reset file input so same file can be picked again
    (event.target as HTMLInputElement).value = '';
  }

  removeFormImage(index: number) {
    const img = this.formImages[index];
    if (img.id > 0) this.deletedImageIds.push(img.id);
    this.formImages.splice(index, 1);
  }

  save() {
    if (!this.form.garmentType) return;
    this.saving = true;

    if (this.editingId) {
      // Update design metadata
      this.svc.updateDesign(this.editingId, { ...this.form }).pipe(
        switchMap(() => {
          const designId = this.editingId!;
          // Delete removed images
          const deletes = this.deletedImageIds.map(imgId => this.svc.deleteDesignImage(designId, imgId));
          // Add new (pending) images
          const adds = this.formImages
            .filter(img => img.pending)
            .map(img => this.svc.addDesignImage(designId, img.imageUrl, img.publicId));
          const all = [...deletes, ...adds];
          return all.length ? forkJoin(all) : of([]);
        })
      ).subscribe({
        next: () => { this.showForm = false; this.saving = false; this.load(); },
        error: () => { this.saving = false; }
      });
    } else {
      // Create design with images
      const payload = {
        ...this.form,
        images: this.formImages.map(img => ({ imageUrl: img.imageUrl, publicId: img.publicId }))
      };
      this.svc.createDesign(payload).subscribe({
        next: () => { this.showForm = false; this.saving = false; this.load(); },
        error: () => { this.saving = false; }
      });
    }
  }

  remove(id: number) {
    if (!confirm('Delete this design?')) return;
    this.svc.deleteDesign(id).subscribe({ next: () => this.load(), error: () => {} });
  }
}
