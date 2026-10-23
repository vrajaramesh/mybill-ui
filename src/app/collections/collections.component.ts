import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { BoutiqueService, FabricSearchResult } from '../boutique.service';

/** A collection item as the API returns it (product details come from Products). */
interface CollectionItem {
  item_id?: number;
  item_code: string;
  product_id: number | null;
  colour: string;
  image_url: string | null;
  product_name?: string | null;
  unit?: string | null;
  price?: number | null;
  stock?: number | null;
  available?: boolean;
  sizes?: { size: string; stock: number }[];
}

interface Collection {
  collection_id?: number;
  code: string;
  name: string;
  type: 'FABRIC' | 'READYMADE';
  description: string;
  cover_image_url: string | null;
  ai_instructions: string;
  active: boolean;
  items?: CollectionItem[];
  warnings?: string[];
  item_count?: number;
}

/**
 * Boutique → Collections: fabric / readymade collections, one per Instagram post, whose items (codes printed on the
 * photos, e.g. MCS-1A) the WhatsApp assistant sells. Prices, stock and sizes come from Products.
 */
@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.css'
})
export class CollectionsComponent implements OnInit {
  list: Collection[] = [];
  loading = false;
  edit: Collection | null = null;
  items: CollectionItem[] = [];
  itemsChanged = false;
  saving = false;
  error = '';
  saved = '';
  uploading = false;

  // product picker for one item row
  pickFor: number | null = null;
  query = '';
  results: FabricSearchResult[] = [];

  constructor(private http: HttpClient, private boutique: BoutiqueService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<Collection[]>('/api/boutique-collections').subscribe({
      next: l => { this.list = l; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  newCollection() {
    this.edit = { code: '', name: '', type: 'FABRIC', description: '', cover_image_url: null, ai_instructions: '', active: true };
    this.items = [];
    this.itemsChanged = false;
    this.error = this.saved = '';
  }

  open(c: Collection) {
    this.error = this.saved = '';
    this.http.get<Collection>(`/api/boutique-collections/${c.collection_id}`).subscribe({
      next: full => this.show(full),
      error: err => this.error = err?.error?.message || 'Could not open the collection'
    });
  }

  private show(full: Collection) {
    this.edit = { ...full, description: full.description || '', ai_instructions: full.ai_instructions || '' };
    this.items = (full.items || []).map(i => ({ ...i, colour: i.colour || '' }));
    this.itemsChanged = false;
  }

  close() { this.edit = null; this.items = []; this.pickFor = null; }

  addItem() {
    const prefix = this.edit?.code ? this.edit.code.toUpperCase() : '';
    const letter = String.fromCharCode(65 + this.items.length);   // A, B, C ...
    this.items.push({ item_code: prefix ? `${prefix}${letter}` : '', product_id: null, colour: '', image_url: null });
    this.itemsChanged = true;
    this.pickFor = this.items.length - 1;
    this.query = '';
    this.results = [];
  }

  removeItem(i: number) { this.items.splice(i, 1); this.itemsChanged = true; }

  move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= this.items.length) return;
    [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    this.itemsChanged = true;
  }

  startPick(i: number) { this.pickFor = i; this.query = ''; this.results = []; }

  search() {
    const q = this.query.trim();
    if (q.length < 2) { this.results = []; return; }
    this.boutique.searchFabrics(q).subscribe({ next: r => this.results = r, error: () => this.results = [] });
  }

  pick(p: FabricSearchResult) {
    if (this.pickFor === null) return;
    const item = this.items[this.pickFor];
    item.product_id = p.productId;
    item.product_name = p.name;
    item.unit = p.unit;
    item.price = p.price;
    item.stock = p.stock;
    item.sizes = undefined;
    this.itemsChanged = true;
    this.pickFor = null;
    this.results = [];
  }

  markChanged() { this.itemsChanged = true; }

  onCover(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.edit) return;
    this.uploading = true;
    this.boutique.uploadToCloudinary(file).subscribe({
      next: (r: any) => { this.uploading = false; if (this.edit) this.edit.cover_image_url = r.secure_url || r.url; },
      error: () => { this.uploading = false; this.error = 'Photo upload failed'; }
    });
    (event.target as HTMLInputElement).value = '';
  }

  save() {
    if (!this.edit || this.saving) return;
    this.saving = true;
    this.error = this.saved = '';
    const body = { ...this.edit, code: this.edit.code.trim().toUpperCase() };
    delete (body as any).items; delete (body as any).warnings;
    const req = this.edit.collection_id
      ? this.http.put<Collection>(`/api/boutique-collections/${this.edit.collection_id}`, body)
      : this.http.post<Collection>('/api/boutique-collections', body);
    req.subscribe({
      next: c => {
        if (!this.itemsChanged) { this.done(c); return; }
        const items = this.items.map(i => ({ item_code: i.item_code.trim().toUpperCase(), product_id: i.product_id,
                                             colour: i.colour?.trim() || null, image_url: i.image_url || null }));
        this.http.put<Collection>(`/api/boutique-collections/${c.collection_id}/items`, { items }).subscribe({
          next: full => this.done(full),
          error: err => { this.saving = false; this.edit!.collection_id = c.collection_id; this.error = err?.error?.message || 'Items not saved'; }
        });
      },
      error: err => { this.saving = false; this.error = err?.error?.message || 'Could not save'; }
    });
  }

  private done(c: Collection) {
    this.saving = false;
    this.saved = 'Saved ✓';
    this.show(c);
    this.load();
  }

  remove() {
    if (!this.edit?.collection_id || !confirm(`Delete collection ${this.edit.code}? Its items are removed too (products stay).`)) return;
    this.http.delete(`/api/boutique-collections/${this.edit.collection_id}`).subscribe({
      next: () => { this.close(); this.load(); },
      error: err => this.error = err?.error?.message || 'Could not delete'
    });
  }

  sizesText(i: CollectionItem): string {
    return (i.sizes || []).map(s => `${s.size}:${+s.stock}`).join('  ');
  }
}
