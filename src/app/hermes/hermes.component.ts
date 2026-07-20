import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface ProductContent {
  productId: number;
  productName: string;
  sellingPrice: number;
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

  // ── Instagram Reels ──────────────────────────────────────────────────────────
  reelsSelectedIds = new Set<number>();
  reelsJobs: ReelsJob[] = [];
  reelsPoller: any = null;

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
    const payload = JSON.parse(atob(this.token.split('.')[1] || 'e30='));
    return (payload.firmCode || '').toLowerCase();
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

  toggleReelsProduct(id: number) {
    if (this.reelsSelectedIds.has(id)) this.reelsSelectedIds.delete(id);
    else this.reelsSelectedIds.add(id);
  }

  get reelsSelectedList(): ProductContent[] {
    return this.contents.filter(c => this.reelsSelectedIds.has(c.productId));
  }

  postReel() {
    const ids = [...this.reelsSelectedIds];
    if (ids.length === 0) return;

    this.http.post<any>('/api/instagram/reels/publish', { productIds: ids }, { headers: this.headers })
      .subscribe({
        next: res => {
          const job: ReelsJob = {
            jobId: res.jobId,
            status: 'queued',
            message: res.message,
            instagramPostId: '',
            videoUrl: '',
            productNames: this.reelsSelectedList.map(p => p.productName).join(', '),
            startedAt: new Date()
          };
          this.reelsJobs.unshift(job);
          this.reelsSelectedIds.clear();
          this.startPolling();
        },
        error: err => this.error = err.error?.error || 'Failed to start Reel'
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
