import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

/** Row of GET /api/boutique-marketing/links: a Click-to-WhatsApp ad or Instagram post mapped to a design. */
export interface MarketingLink {
  link_id: number;
  source_type: 'AD' | 'IG_MEDIA';
  source_id: string;
  design_code: string;
  design_name: string | null;
  label: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignOption { code: string; name: string; active: boolean; }

interface LinkForm { source_type: 'AD' | 'IG_MEDIA'; source_id: string; design_code: string; label: string; }

@Component({
  selector: 'app-ad-links',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-links.component.html',
  styleUrl: './ad-links.component.css'
})
export class AdLinksComponent implements OnInit {
  links: MarketingLink[] = [];
  designs: DesignOption[] = [];
  loading = false;
  error = '';

  /** null = form closed; editingId null with an open form = new link. */
  form: LinkForm | null = null;
  editingId: number | null = null;
  formError = '';
  saving = false;

  readonly typeLabel: { [t: string]: string } = { 'AD': 'Click-to-WhatsApp ad', 'IG_MEDIA': 'Instagram post' };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
    this.http.get<DesignOption[]>('/api/boutique-marketing/designs', { headers: this.headers() })
      .subscribe({ next: d => this.designs = d, error: () => this.designs = [] });
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('mybill_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  load() {
    this.loading = true;
    this.error = '';
    this.http.get<MarketingLink[]>('/api/boutique-marketing/links', { headers: this.headers() }).subscribe({
      next: links => { this.links = links; this.loading = false; },
      error: err => { this.loading = false; this.error = err?.error?.message || 'Could not load links'; }
    });
  }

  openNew() {
    this.editingId = null;
    this.formError = '';
    this.form = { source_type: 'AD', source_id: '', design_code: this.designs[0]?.code || '', label: '' };
  }

  edit(link: MarketingLink) {
    this.editingId = link.link_id;
    this.formError = '';
    this.form = { source_type: link.source_type, source_id: link.source_id, design_code: link.design_code, label: link.label };
  }

  cancel() { this.form = null; this.editingId = null; this.formError = ''; }

  /** Client-side checks mirror the server (which re-validates). */
  private validate(f: LinkForm): string {
    if (!/^[0-9]{1,40}$/.test(f.source_id.trim())) return 'The ID must be numeric (copy it from Meta Ads Manager / Instagram).';
    if (!f.design_code) return 'Pick a design.';
    if (!this.designs.some(d => d.code === f.design_code)) return 'That design does not exist.';
    if (!f.label.trim()) return 'Give the link a label, e.g. "Mustard kurti reel – Diwali boost".';
    if (f.label.trim().length > 150) return 'The label can be at most 150 characters.';
    return '';
  }

  save() {
    if (!this.form) return;
    const f = { ...this.form, source_id: this.form.source_id.trim(), label: this.form.label.trim() };
    this.formError = this.validate(f);
    if (this.formError) return;
    this.saving = true;
    const req = this.editingId == null
      ? this.http.post<MarketingLink>('/api/boutique-marketing/links', f, { headers: this.headers() })
      : this.http.put<MarketingLink>(`/api/boutique-marketing/links/${this.editingId}`, f, { headers: this.headers() });
    req.subscribe({
      next: () => { this.saving = false; this.cancel(); this.load(); },
      error: err => { this.saving = false; this.formError = err?.error?.message || 'Could not save the link'; }
    });
  }

  setActive(link: MarketingLink, active: boolean) {
    if (!active && !confirm(`Deactivate "${link.label}"? New conversations from this ${this.typeLabel[link.source_type].toLowerCase()} will no longer open its design.`)) return;
    this.http.post<MarketingLink>(`/api/boutique-marketing/links/${link.link_id}/${active ? 'activate' : 'deactivate'}`, {},
      { headers: this.headers() }).subscribe({
      next: updated => { Object.assign(link, updated); },
      error: err => { this.error = err?.error?.message || 'Could not update the link'; }
    });
  }
}
