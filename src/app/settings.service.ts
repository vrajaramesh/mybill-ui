import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

/**
 * Retail store details (name, GSTIN, address, logo, WhatsApp phone, website) and WhatsApp bot settings.
 *
 * These belong to a FIRM, not to a device: the source of truth is the firm's `firm_settings` table
 * (`/api/settings`), and the browser copy is kept per firm (`<key>::<firmCode>`), so logging into another
 * firm on the same device never shows the previous firm's name/phone. `loadFromBackend()` refreshes the copy
 * after login and on app open.
 */

// Browser keys (suffixed with ::<firmCode>) → server keys in firm_settings
const FIELDS = {
  firmName:      { local: 'mybill_settings_firm_name', server: 'store_firm_name' },
  gst:           { local: 'mybill_settings_gst',       server: 'store_gst' },
  address:       { local: 'mybill_settings_address',   server: 'store_address' },
  logo:          { local: 'mybill_settings_logo',      server: 'store_logo' },
  website:       { local: 'mybill_settings_website',   server: 'store_website' },
  whatsappPhone: { local: 'mybill_business_phone',     server: 'whatsappPhone' },
  waPhoneId:     { local: 'wa_phone_number_id',        server: 'whatsapp_phone_number_id' },
  waToken:       { local: 'wa_access_token',           server: 'whatsapp_access_token' },
  waVerify:      { local: 'wa_verify_token',           server: 'whatsapp_verify_token' },
  ecomUrl:       { local: 'wa_ecom_url',               server: 'ecom_url' },
} as const;
type Field = keyof typeof FIELDS;

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private _firmName$ = new BehaviorSubject<string>('');
  private _logo$     = new BehaviorSubject<string>('');

  readonly firmName$ = this._firmName$.asObservable();
  readonly logo$     = this._logo$.asObservable();

  /** Store name: the one saved for this firm, else the firm's registered name from login. */
  get firmName(): string      { return this.get('firmName') || this.loginFirmName(); }
  get logo(): string          { return this.get('logo'); }
  get gstNumber(): string     { return this.get('gst'); }
  get address(): string       { return this.get('address'); }
  get website(): string       { return this.get('website'); }
  get whatsappPhone(): string { return this.get('whatsappPhone'); }

  constructor(private http: HttpClient) {
    this.emit();
  }

  // ── per-firm browser copy ────────────────────────────────

  private firmKey(): string {
    try {
      const f = JSON.parse(localStorage.getItem('mybill_current_firm') || 'null');
      return String(f?.firmCode || f?.firmId || 'default').toLowerCase();
    } catch {
      return 'default';
    }
  }

  private loginFirmName(): string {
    try {
      return JSON.parse(localStorage.getItem('mybill_current_firm') || 'null')?.firmName || '';
    } catch {
      return '';
    }
  }

  private localKey(f: Field): string { return `${FIELDS[f].local}::${this.firmKey()}`; }

  private get(f: Field): string { return localStorage.getItem(this.localKey(f)) || ''; }

  private setLocal(f: Field, value: string): void {
    if (value) localStorage.setItem(this.localKey(f), value);
    else localStorage.removeItem(this.localKey(f));
  }

  /** Saves locally for this firm and on the server (firm_settings). */
  private save(f: Field, value: string): void {
    this.setLocal(f, value);
    this.emit();
    this.http.put('/api/settings', { [FIELDS[f].server]: value }, { headers: this.headers() })
      .subscribe({ error: () => {} });
  }

  private emit(): void {
    this._firmName$.next(this.firmName);
    this._logo$.next(this.logo);
  }

  private headers(): HttpHeaders {
    const t = localStorage.getItem('mybill_token');
    return t ? new HttpHeaders({ Authorization: `Bearer ${t}` }) : new HttpHeaders();
  }

  // ── setters (public API unchanged) ───────────────────────

  saveFirmName(name: string): void      { this.save('firmName', name.trim()); }
  saveGstNumber(gst: string): void      { this.save('gst', gst.trim().toUpperCase()); }
  saveAddress(addr: string): void       { this.save('address', addr.trim()); }
  saveWebsite(url: string): void        { this.save('website', url.trim()); }
  saveLogo(dataUrl: string): void       { this.save('logo', dataUrl); }
  clearLogo(): void                     { this.save('logo', ''); }
  saveWhatsappPhone(phone: string): void { this.save('whatsappPhone', phone.trim()); }

  saveWhatsappApiCredentials(phoneNumberId: string, accessToken: string, verifyToken: string, ecomUrl: string): void {
    const payload: { [k: string]: string } = {};
    const put = (f: Field, v: string) => { if (v.trim()) { payload[FIELDS[f].server] = v.trim(); this.setLocal(f, v.trim()); } };
    put('waPhoneId', phoneNumberId);
    put('waToken', accessToken);
    put('waVerify', verifyToken);
    put('ecomUrl', ecomUrl);
    this.http.put('/api/settings', payload, { headers: this.headers() }).subscribe({ error: () => {} });
  }

  getWhatsappApiSettings(): { [key: string]: string } {
    return {
      whatsapp_phone_number_id: this.get('waPhoneId'),
      whatsapp_access_token:    this.get('waToken'),
      whatsapp_verify_token:    this.get('waVerify'),
      ecom_url:                 this.get('ecomUrl'),
    };
  }

  // ── server sync ──────────────────────────────────────────

  /**
   * Replaces this firm's browser copy with the server values (called after login / on app open).
   * Values missing on the server are cleared, so nothing carries over from another firm.
   */
  loadFromBackend(): Promise<void> {
    if (!localStorage.getItem('mybill_token')) return Promise.resolve();
    return new Promise(resolve => {
      this.http.get<{ [key: string]: string }>('/api/settings', { headers: this.headers() }).subscribe({
        next: data => {
          this.migrateLegacyDeviceSettings(data || {});
          (Object.keys(FIELDS) as Field[]).forEach(f => this.setLocal(f, (data || {})[FIELDS[f].server] || ''));
          this.emit();
          resolve();
        },
        error: () => { this.emit(); resolve(); }
      });
    });
  }

  /**
   * Before 2026-10-10 the store details were saved per DEVICE (no firm suffix). They are copied to the
   * server only for the firm they were typed for — i.e. when the old store name matches this firm's name —
   * and only into fields the firm has not set yet. Other firms on the same device get nothing from them.
   */
  private migrateLegacyDeviceSettings(server: { [key: string]: string }): void {
    const legacyName = localStorage.getItem('mybill_settings_firm_name') || '';
    if (!legacyName || !this.sameStore(legacyName, this.loginFirmName())) return;

    const payload: { [k: string]: string } = {};
    const legacy: [Field, string][] = [
      ['firmName', 'mybill_settings_firm_name'], ['gst', 'mybill_settings_gst'], ['address', 'mybill_settings_address'],
      ['logo', 'mybill_settings_logo'], ['whatsappPhone', 'mybill_business_phone'],
    ];
    for (const [f, key] of legacy) {
      const v = localStorage.getItem(key);
      if (v && !server[FIELDS[f].server]) { payload[FIELDS[f].server] = v; server[FIELDS[f].server] = v; }
    }
    if (Object.keys(payload).length) {
      this.http.put('/api/settings', payload, { headers: this.headers() }).subscribe({ error: () => {} });
    }
  }

  /** "SRISA FABRICS" vs "Srisa Fabrics Pvt" → same; "SRISA FABRICS" vs "Srihitha Boutique" → different. */
  private sameStore(a: string, b: string): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const wa = norm(a), wb = norm(b);
    return wa.length > 0 && wb.length > 0 && wa[0] === wb[0];
  }
}
