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
  cost_price?: number | null;
  wholesale_product_id?: number | null;   // WHOLESALE collections: the Wholesale-module product
  product_code?: string | null;
  in_stock?: boolean;
}

/** An active product of the Wholesale module (items of a WHOLESALE collection). */
interface WholesaleProduct {
  wholesale_product_id: number;
  code: string | null;
  name: string;
  unit: string;
}

/** Slabs and minimum order of a wholesale collection (they apply to the collection's total quantity). */
interface WholesalePricing {
  product_name?: string;
  unit?: string;
  gst_pct?: number;
  minimum_order?: number | null;
  price_slabs?: { from: number; to: number | null; price_per_unit: number }[];
  products?: WholesalePricing[];
}

/** A dropship supplier (stocks and ships a DROPSHIP collection; paid per order). */
interface Supplier {
  id?: number;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  pincode: string;
  paymentDetails: string;
  dispatchDays: number;
  notes: string;
  active: boolean;
}

/** Courier charge per distance zone (supplier pincode -> customer pincode). */
const ZONES: { key: string; label: string; hint: string }[] = [
  { key: 'LOCAL', label: 'Local', hint: 'same city (first 3 pincode digits)' },
  { key: 'STATE', label: 'Within state', hint: 'first 2 digits same' },
  { key: 'REGION', label: 'Region', hint: 'first digit same, e.g. South India' },
  { key: 'NATIONAL', label: 'Rest of India', hint: 'all other pincodes' },
  { key: 'SPECIAL', label: 'NE / J&K / islands', hint: 'North East, J&K, Ladakh, Andaman' },
];

interface Collection {
  collection_id?: number;
  code: string;
  name: string;
  type: 'FABRIC' | 'READYMADE' | 'DROPSHIP' | 'WHOLESALE';
  description: string;
  cover_image_url: string | null;
  ai_instructions: string;
  active: boolean;
  items?: CollectionItem[];
  warnings?: string[];
  item_count?: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  courier_slabs?: Record<string, number | null>;
  courier_extra_per_piece?: number | null;
  wholesale?: WholesalePricing;
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

  // wholesale products (picker for WHOLESALE collections)
  wholesaleProducts: WholesaleProduct[] = [];
  wholesaleResults: WholesaleProduct[] = [];

  // dropship suppliers
  readonly zones = ZONES;
  suppliers: Supplier[] = [];
  showSuppliers = false;
  supplierEdit: Supplier | null = null;
  supplierError = '';

  constructor(private http: HttpClient, private boutique: BoutiqueService) {}

  ngOnInit() { this.load(); this.loadSuppliers(); this.loadWholesaleProducts(); }

  loadWholesaleProducts() {
    this.http.get<WholesaleProduct[]>('/api/boutique-collections/wholesale-products')
      .subscribe({ next: l => this.wholesaleProducts = l, error: () => {} });
  }

  get isWholesale(): boolean { return this.edit?.type === 'WHOLESALE'; }

  /** One product's slabs, or each product's when the items use several. */
  get pricingList(): WholesalePricing[] {
    const w = this.edit?.wholesale;
    return !w ? [] : w.products?.length ? w.products : (w.price_slabs ? [w] : []);
  }

  slabText(s: { from: number; to: number | null; price_per_unit: number }, unit?: string): string {
    return `${+s.from}${s.to != null ? '–' + (+s.to) : '+'} ${unit || ''}: ₹${s.price_per_unit}`;
  }

  loadSuppliers() {
    this.http.get<Supplier[]>('/api/boutique-suppliers').subscribe({ next: l => this.suppliers = l, error: () => {} });
  }

  get activeSuppliers(): Supplier[] { return this.suppliers.filter(s => s.active || s.id === this.edit?.supplier_id); }

  newSupplier() {
    this.supplierError = '';
    this.supplierEdit = { name: '', contactPerson: '', phone: '', address: '', pincode: '', paymentDetails: '',
                          dispatchDays: 2, notes: '', active: true };
  }

  editSupplier(s: Supplier) { this.supplierError = ''; this.supplierEdit = { ...s }; }

  saveSupplier() {
    const s = this.supplierEdit;
    if (!s) return;
    const body = { name: s.name, contact_person: s.contactPerson, phone: s.phone, address: s.address, pincode: s.pincode,
                   payment_details: s.paymentDetails, dispatch_days: s.dispatchDays, notes: s.notes, active: s.active };
    const req = s.id ? this.http.put<Supplier>(`/api/boutique-suppliers/${s.id}`, body)
                     : this.http.post<Supplier>('/api/boutique-suppliers', body);
    req.subscribe({
      next: () => { this.supplierEdit = null; this.loadSuppliers(); },
      error: err => this.supplierError = err?.error?.message || 'Could not save the supplier'
    });
  }

  deleteSupplier(s: Supplier) {
    if (!s.id || !confirm(`Delete supplier ${s.name}?`)) return;
    this.http.delete(`/api/boutique-suppliers/${s.id}`).subscribe({
      next: () => { this.supplierEdit = null; this.loadSuppliers(); },
      error: err => this.supplierError = err?.error?.message || 'Could not delete'
    });
  }

  typeLabel(t: string): string {
    return t === 'FABRIC' ? '🧵 Fabric' : t === 'DROPSHIP' ? '🛒 Dropship' : t === 'WHOLESALE' ? '🏭 Wholesale' : '👗 Readymade';
  }

  onTypeChange() {
    if (this.edit?.type === 'DROPSHIP' && !this.edit.courier_slabs) this.edit.courier_slabs = {};
  }

  /** Selling price - supplier cost for one piece (courier is passed on to the customer). */
  margin(i: CollectionItem): number | null {
    return i.price != null && i.cost_price != null ? +i.price - +i.cost_price : null;
  }

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

  /** Item photos are their own for wholesale designs (the product photo is the fallback). */
  onItemPhoto(event: Event, it: CollectionItem) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.boutique.uploadToCloudinary(file).subscribe({
      next: (r: any) => { this.uploading = false; it.image_url = r.secure_url || r.url; this.itemsChanged = true; },
      error: () => { this.uploading = false; this.error = 'Photo upload failed'; }
    });
    (event.target as HTMLInputElement).value = '';
  }

  open(c: Collection) {
    this.error = this.saved = '';
    this.http.get<Collection>(`/api/boutique-collections/${c.collection_id}`).subscribe({
      next: full => this.show(full),
      error: err => this.error = err?.error?.message || 'Could not open the collection'
    });
  }

  private show(full: Collection) {
    this.edit = { ...full, description: full.description || '', ai_instructions: full.ai_instructions || '',
                  courier_slabs: { ...(full.courier_slabs || {}) } };
    this.items = (full.items || []).map(i => ({ ...i, colour: i.colour || '' }));
    this.itemsChanged = false;
  }

  close() { this.edit = null; this.items = []; this.pickFor = null; }

  addItem() {
    const prefix = this.edit?.code ? this.edit.code.toUpperCase() : '';
    const letter = String.fromCharCode(65 + this.items.length);   // A, B, C ...
    const code = !prefix ? '' : this.isWholesale ? `${prefix}-${this.items.length + 1}` : `${prefix}${letter}`;  // wholesale: MCS-1, MCS-2
    const last = this.items[this.items.length - 1];
    this.items.push({ item_code: code, product_id: null, colour: '', image_url: null,
                      ...(this.isWholesale && last?.wholesale_product_id
                          ? { wholesale_product_id: last.wholesale_product_id, product_name: last.product_name, unit: last.unit } : {}) });
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

  startPick(i: number) {
    this.pickFor = i; this.query = ''; this.results = [];
    this.wholesaleResults = this.isWholesale ? this.wholesaleProducts.slice(0, 20) : [];
  }

  pickWholesale(p: WholesaleProduct) {
    if (this.pickFor === null) return;
    const item = this.items[this.pickFor];
    item.wholesale_product_id = p.wholesale_product_id;
    item.product_name = p.name;
    item.product_code = p.code;
    item.unit = p.unit;
    item.in_stock = undefined;   // shown after saving
    this.itemsChanged = true;
    this.pickFor = null;
    this.wholesaleResults = [];
  }

  search() {
    const q = this.query.trim();
    if (this.isWholesale) {
      const t = q.toLowerCase();
      this.wholesaleResults = this.wholesaleProducts
        .filter(p => !t || p.name.toLowerCase().includes(t) || (p.code || '').toLowerCase().includes(t)).slice(0, 20);
      return;
    }
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
    item.cost_price = undefined;   // shown after saving
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
    if (body.type !== 'DROPSHIP') { delete body.supplier_id; delete body.courier_slabs; delete body.courier_extra_per_piece; }
    const req = this.edit.collection_id
      ? this.http.put<Collection>(`/api/boutique-collections/${this.edit.collection_id}`, body)
      : this.http.post<Collection>('/api/boutique-collections', body);
    req.subscribe({
      next: c => {
        if (!this.itemsChanged) { this.done(c); return; }
        const items = this.items.map(i => ({ item_code: i.item_code.trim().toUpperCase(), product_id: i.product_id,
                                             wholesale_product_id: i.wholesale_product_id ?? null,
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
