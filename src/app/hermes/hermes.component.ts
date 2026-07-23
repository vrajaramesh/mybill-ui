import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface ProductContent {
  productId: number;
  productName: string;
  sellingPrice: number;
  category: string;
  imageUrl: string;
  instagramCaption: string;
  whatsappText: string;
  hashtags: string;
  seoDescription: string;
  generatedAt: string;
}

interface Campaign {
  id: number;
  campaignType: string;
  caption: string;
  imageUrl: string;
  channel: string;
  status: string;
  sentCount: number;
  failedCount: number;
  executedAt: string;
  createdAt: string;
}

interface Contact {
  id: number;
  phone: string;
  customerName: string;
  optedIn: boolean;
  addedBy: string;
  lastMessaged: string;
  createdAt: string;
}

interface ReelsImage {
  id: number;
  imageUrl: string;
  mediaType: string;
}

interface ReelsJob {
  jobId: string;
  status: string;
  message: string;
  instagramPostId: string;
  videoUrl: string;
  productNames: string;
  startedAt: Date;
}

interface HermesStats {
  contentGenerated: number;
  campaignsSent: number;
  totalMessagesSent: number;
  activeContacts: number;
}

@Component({
  selector: 'app-hermes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hermes.component.html',
  styleUrl: './hermes.component.css'
})
export class HermesComponent implements OnInit {

  activeTab: 'content' | 'campaigns' | 'contacts' | 'reels' = 'content';

  stats: HermesStats = { contentGenerated: 0, campaignsSent: 0, totalMessagesSent: 0, activeContacts: 0 };
  contents: ProductContent[] = [];
  campaigns: Campaign[] = [];
  contacts: Contact[] = [];

  // ── Reels product filter ─────────────────────────────────────────────────────
  reelsFilterText = '';
  reelsFilterCategory = '';

  get reelsCategories(): string[] {
    const cats = this.contents.map(c => c.category).filter(Boolean);
    return [...new Set(cats)].sort();
  }

  get reelsFilteredContents(): ProductContent[] {
    const text = this.reelsFilterText.trim().toLowerCase();
    const cat  = this.reelsFilterCategory;
    return this.contents.filter(c => {
      const matchesText = !text
        || String(c.productId).includes(text)
        || c.productName?.toLowerCase().includes(text);
      const matchesCat = !cat || c.category === cat;
      return matchesText && matchesCat;
    });
  }

  clearReelsFilter() {
    this.reelsFilterText = '';
    this.reelsFilterCategory = '';
  }

  // ── Instagram Reels ──────────────────────────────────────────────────────────
  // The 5-slot selection tray (photos from any product)
  reelsSelection: Array<{url: string; productId: number; productName: string}> = [];
  // Which product's images are currently shown in the picker
  reelsPickerProduct: ProductContent | null = null;
  reelsPickerImages: ReelsImage[] = [];
  reelsPickerLoading = false;
  reelsJobs: ReelsJob[] = [];
  reelsPoller: any = null;
  reelsTitle = '';
  reelsPosting = false;

  // New contact form
  newPhone = '';
  newName = '';

  // Broadcast form
  broadcastCaption = '';
  broadcastImageUrl = '';
  broadcastSending = false;
  broadcastResult: string | null = null;

  // UI state
  loading = false;
  error: string | null = null;
  copiedId: number | null = null;
  expandedId: number | null = null;
  regeneratingIds = new Set<number>();

  private get token() { return localStorage.getItem('mybill_token') || ''; }
  private get firmCode() {
    const firm = JSON.parse(localStorage.getItem('mybill_current_firm') || '{}');
    return (firm.firmCode || '').toLowerCase();
  }
  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadContent();
  }

  // ── Tab navigation ─────────────────────────────────────────────────────────

  selectTab(tab: 'content' | 'campaigns' | 'contacts' | 'reels') {
    this.activeTab = tab;
    if (tab === 'campaigns' && this.campaigns.length === 0) this.loadCampaigns();
    if (tab === 'contacts' && this.contacts.length === 0) this.loadContacts();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  loadStats() {
    this.http.get<HermesStats>(`/api/hermes/${this.firmCode}/stats`, { headers: this.headers })
      .subscribe({ next: s => this.stats = s, error: () => {} });
  }

  // ── Product Content ────────────────────────────────────────────────────────

  loadContent() {
    this.loading = true;
    this.http.get<ProductContent[]>(`/api/hermes/${this.firmCode}/content`, { headers: this.headers })
      .subscribe({
        next: data => { this.contents = data; this.loading = false; },
        error: err => { this.error = err.error?.error || 'Failed to load'; this.loading = false; }
      });
  }

  regenerate(productId: number) {
    this.regeneratingIds.add(productId);
    this.http.post(`/api/hermes/${this.firmCode}/content/${productId}/regenerate`, {}, { headers: this.headers })
      .subscribe({
        next: () => {
          setTimeout(() => {
            this.regeneratingIds.delete(productId);
            this.loadContent();
            this.loadStats();
          }, 8000);
        },
        error: () => this.regeneratingIds.delete(productId)
      });
  }

  toggleExpand(id: number) {
    this.expandedId = this.expandedId === id ? null : id;
  }

  copyText(text: string, id: number) {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedId = id;
      setTimeout(() => this.copiedId = null, 2000);
    });
  }

  isRegenrating(id: number) { return this.regeneratingIds.has(id); }

  // ── Campaigns ──────────────────────────────────────────────────────────────

  loadCampaigns() {
    this.loading = true;
    this.http.get<Campaign[]>(`/api/hermes/${this.firmCode}/campaigns`, { headers: this.headers })
      .subscribe({
        next: data => { this.campaigns = data; this.loading = false; },
        error: err => { this.error = err.error?.error || 'Failed to load'; this.loading = false; }
      });
  }

  sendBroadcast() {
    if (!this.broadcastCaption.trim()) return;
    this.broadcastSending = true;
    this.broadcastResult = null;
    this.http.post<any>(`/api/hermes/${this.firmCode}/broadcast`,
      { caption: this.broadcastCaption, imageUrl: this.broadcastImageUrl || null },
      { headers: this.headers })
      .subscribe({
        next: r => {
          this.broadcastSending = false;
          this.broadcastResult = `Sent: ${r.sent}, Failed: ${r.failed}`;
          this.broadcastCaption = '';
          this.broadcastImageUrl = '';
          this.loadCampaigns();
          this.loadStats();
        },
        error: err => {
          this.broadcastSending = false;
          this.broadcastResult = 'Error: ' + (err.error?.error || 'Failed');
        }
      });
  }

  // ── Contacts ───────────────────────────────────────────────────────────────

  loadContacts() {
    this.loading = true;
    this.http.get<Contact[]>(`/api/hermes/${this.firmCode}/contacts`, { headers: this.headers })
      .subscribe({
        next: data => { this.contacts = data; this.loading = false; },
        error: err => { this.error = err.error?.error || 'Failed to load'; this.loading = false; }
      });
  }

  addContact() {
    if (!this.newPhone.trim()) return;
    this.http.post(`/api/hermes/${this.firmCode}/contacts`,
      { phone: this.newPhone.trim(), customerName: this.newName.trim() || null },
      { headers: this.headers })
      .subscribe({
        next: () => {
          this.newPhone = '';
          this.newName = '';
          this.loadContacts();
          this.loadStats();
        },
        error: err => this.error = err.error?.error || 'Failed to add'
      });
  }

  removeContact(id: number) {
    this.http.delete(`/api/hermes/${this.firmCode}/contacts/${id}`, { headers: this.headers })
      .subscribe({ next: () => this.loadContacts(), error: () => {} });
  }

  // ── Instagram Reels ────────────────────────────────────────────────────────

  get reelsReady(): boolean { return this.reelsSelection.length === 5; }

  selectPickerProduct(product: ProductContent) {
    if (this.reelsPickerProduct?.productId === product.productId) return;
    this.reelsPickerProduct = product;
    this.reelsPickerImages = [];
    this.reelsPickerLoading = true;
    this.http.get<ReelsImage[]>(`/api/products/${product.productId}/images`, { headers: this.headers })
      .subscribe({
        next: imgs => {
          this.reelsPickerImages = imgs.filter(i => i.mediaType !== 'video' && i.imageUrl?.startsWith('https://'));
          this.reelsPickerLoading = false;
        },
        error: () => { this.reelsPickerLoading = false; }
      });
  }

  addPhoto(url: string) {
    if (this.reelsSelection.length >= 5 || this.isPhotoSelected(url)) return;
    this.reelsSelection.push({
      url,
      productId: this.reelsPickerProduct!.productId,
      productName: this.reelsPickerProduct!.productName
    });
  }

  removePhoto(index: number) {
    this.reelsSelection.splice(index, 1);
  }

  isPhotoSelected(url: string): boolean {
    return this.reelsSelection.some(s => s.url === url);
  }

  postReel() {
    if (!this.reelsReady || this.reelsPosting) return;
    this.reelsPosting = true;
    const payload: any = {
      productId: this.reelsSelection[0].productId,
      imageUrls: this.reelsSelection.map(s => s.url)
    };
    if (this.reelsTitle.trim()) payload.title = this.reelsTitle.trim();

    this.http.post<any>('/api/instagram/reels/publish', payload, { headers: this.headers })
      .subscribe({
        next: res => {
          const names = [...new Set(this.reelsSelection.map(s => s.productName))].join(', ');
          this.reelsJobs.unshift({
            jobId: res.jobId, status: 'queued', message: res.message,
            instagramPostId: '', videoUrl: '', productNames: names, startedAt: new Date()
          });
          this.reelsSelection = [];
          this.reelsTitle = '';
          this.reelsPosting = false;
          this.startPolling();
        },
        error: err => {
          this.error = err.error?.error || 'Failed to start Reel';
          this.reelsPosting = false;
        }
      });
  }

  private startPolling() {
    if (this.reelsPoller) return;
    this.reelsPoller = setInterval(() => this.pollActiveJobs(), 5000);
  }

  private pollActiveJobs() {
    const active = this.reelsJobs.filter(j => !['done', 'failed'].includes(j.status));
    if (active.length === 0) {
      clearInterval(this.reelsPoller);
      this.reelsPoller = null;
      return;
    }
    active.forEach(job => {
      this.http.get<any>(`/api/instagram/reels/status/${job.jobId}`, { headers: this.headers })
        .subscribe({
          next: res => {
            job.status          = res.status;
            job.message         = res.message;
            job.instagramPostId = res.instagramPostId;
            job.videoUrl        = res.videoUrl;
          },
          error: () => {}
        });
    });
  }

  reelsStatusClass(status: string) {
    return {
      queued:     'badge-pending',
      rendering:  'badge-pending',
      uploading:  'badge-pending',
      publishing: 'badge-pending',
      done:       'badge-sent',
      failed:     'badge-failed'
    }[status] || '';
  }

  reelsStatusIcon(status: string) {
    return {
      queued: '&#9679;', rendering: '&#9654;', uploading: '&#8593;',
      publishing: '&#9732;', done: '&#10003;', failed: '&#10007;'
    }[status] || '';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  statusClass(status: string) {
    return { sent: 'badge-sent', pending: 'badge-pending', failed: 'badge-failed', skipped: 'badge-skipped' }[status] || '';
  }

  campaignLabel(type: string) {
    return { new_arrival: 'New Arrival', weekly: 'Weekly', dead_stock: 'Clearance', manual: 'Manual' }[type] || type;
  }
}
