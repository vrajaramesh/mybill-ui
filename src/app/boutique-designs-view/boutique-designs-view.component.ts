import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoutiqueService, FabricSearchResult } from '../boutique.service';
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

  form: { garmentType: string; description: string; roughPrice: number | null; deliveryDays: number | null;
          exactMeasurements: boolean } =
    { garmentType: '', description: '', roughPrice: null, deliveryDays: null, exactMeasurements: false };

  // Fabrics sold separately: srisafabrics.com product links the WhatsApp assistant sends ("fabric only")
  fabricLinks: { url: string; label: string | null; name?: string | null; price?: number | null; unit?: string | null }[] = [];
  fabricsChanged = false;
  fabricUrl = '';
  fabricQuery = '';
  fabricResults: FabricSearchResult[] = [];
  fabricSearching = false;
  fabricError = '';
  readonly shopHost = 'srisafabrics.com';

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
        deliveryDays: d.deliveryDays,
        exactMeasurements: !!d.exactMeasurements
      };
      this.fabricLinks = (d.fabrics || []).map((f: any) => ({ url: f.url, label: f.label, name: f.name, price: f.price, unit: f.unit }));
      // Populate images from design (images array from API)
      this.formImages = (d.images || []).map((img: DesignImage) => ({
        id: img.id, imageUrl: img.imageUrl, publicId: img.publicId || ''
      }));
    } else {
      this.editingId = null;
      this.form = { garmentType: '', description: '', roughPrice: null, deliveryDays: null, exactMeasurements: false };
      this.fabricLinks = [];
      this.formImages = [];
    }
    this.deletedImageIds = [];
    this.fabricQuery = '';
    this.fabricUrl = '';
    this.fabricResults = [];
    this.fabricError = '';
    this.fabricsChanged = false;
    this.showForm = true;
  }

  closeForm() { this.showForm = false; }

  searchFabrics() {
    const q = this.fabricQuery.trim();
    if (q.length < 2) { this.fabricResults = []; return; }
    this.fabricSearching = true;
    this.svc.searchFabrics(q).subscribe({
      next: r => { this.fabricResults = r; this.fabricSearching = false; },
      error: () => { this.fabricResults = []; this.fabricSearching = false; }
    });
  }

  pickFabric(f: FabricSearchResult) {
    this.addFabricLink(f.url, { name: f.name, price: f.price, unit: f.unit });
    this.fabricResults = [];
    this.fabricQuery = '';
  }

  /** Add a pasted srisafabrics.com product link. */
  addPastedLink() {
    if (this.addFabricLink(this.fabricUrl.trim())) this.fabricUrl = '';
  }

  private addFabricLink(url: string, info: { name?: string; price?: number; unit?: string } = {}): boolean {
    this.fabricError = '';
    let parsed: URL;
    try { parsed = new URL(url); } catch { this.fabricError = 'Paste a full link, e.g. https://srisafabrics.com/?product=6223'; return false; }
    if (parsed.protocol !== 'https:' || parsed.hostname.replace(/^www\./, '') !== this.shopHost) {
      this.fabricError = `Only product links from ${this.shopHost} can be added`; return false;
    }
    if (this.fabricLinks.some(l => l.url === url)) { this.fabricError = 'This link is already added'; return false; }
    if (this.fabricLinks.length >= 10) { this.fabricError = 'At most 10 fabric links per design'; return false; }
    this.fabricLinks.push({ url, label: null, ...info });
    this.fabricsChanged = true;
    return true;
  }

  removeFabricLink(i: number) { this.fabricLinks.splice(i, 1); this.fabricsChanged = true; }

  private fabricPayload() { return this.fabricLinks.map(l => ({ url: l.url, label: l.label || null })); }

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
          const fabrics = this.fabricsChanged ? [this.svc.saveDesignFabrics(designId, this.fabricPayload())] : [];
          const all = [...deletes, ...adds, ...fabrics];
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
      this.svc.createDesign(payload).pipe(
        switchMap((res: any) => this.fabricLinks.length && res?.designId
          ? this.svc.saveDesignFabrics(res.designId, this.fabricPayload()) : of([]))
      ).subscribe({
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
