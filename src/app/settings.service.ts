import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

const K_FIRM    = 'mybill_settings_firm_name';
const K_GST     = 'mybill_settings_gst';
const K_WA      = 'mybill_business_phone';
const K_LOGO    = 'mybill_settings_logo';
const K_ADDRESS = 'mybill_settings_address';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private _firmName$ = new BehaviorSubject<string>(localStorage.getItem(K_FIRM) || '');
  private _logo$     = new BehaviorSubject<string>(localStorage.getItem(K_LOGO) || '');

  readonly firmName$ = this._firmName$.asObservable();
  readonly logo$     = this._logo$.asObservable();

  get firmName(): string      { return this._firmName$.getValue(); }
  get logo(): string          { return this._logo$.getValue(); }
  get gstNumber(): string     { return localStorage.getItem(K_GST)     || ''; }
  get address(): string       { return localStorage.getItem(K_ADDRESS) || ''; }
  get whatsappPhone(): string { return localStorage.getItem(K_WA)      || '8008152007'; }

  constructor(private http: HttpClient) {}

  private token(): string | null { return localStorage.getItem('mybill_token'); }

  private headers(): HttpHeaders {
    const t = this.token();
    return t ? new HttpHeaders({ Authorization: `Bearer ${t}` }) : new HttpHeaders();
  }

  saveFirmName(name: string): void {
    const trimmed = name.trim();
    localStorage.setItem(K_FIRM, trimmed);
    this._firmName$.next(trimmed);
  }

  saveGstNumber(gst: string): void {
    localStorage.setItem(K_GST, gst.trim());
  }

  saveAddress(addr: string): void {
    localStorage.setItem(K_ADDRESS, addr.trim());
  }

  saveLogo(dataUrl: string): void {
    localStorage.setItem(K_LOGO, dataUrl);
    this._logo$.next(dataUrl);
  }

  clearLogo(): void {
    localStorage.removeItem(K_LOGO);
    this._logo$.next('');
  }

  saveWhatsappPhone(phone: string): void {
    const trimmed = phone.trim();
    localStorage.setItem(K_WA, trimmed);
    this.http.put('/api/settings', { whatsappPhone: trimmed },
      { headers: this.headers() }).subscribe({ error: () => {} });
  }

  saveWhatsappApiCredentials(phoneNumberId: string, accessToken: string, verifyToken: string, ecomUrl: string): void {
    const payload: { [k: string]: string } = {};
    if (phoneNumberId.trim()) payload['whatsapp_phone_number_id'] = phoneNumberId.trim();
    if (accessToken.trim())   payload['whatsapp_access_token']    = accessToken.trim();
    if (verifyToken.trim())   payload['whatsapp_verify_token']    = verifyToken.trim();
    if (ecomUrl.trim())       payload['ecom_url']                 = ecomUrl.trim();
    this.http.put('/api/settings', payload, { headers: this.headers() })
      .subscribe({ error: () => {} });
  }

  getWhatsappApiSettings(): { [key: string]: string } {
    return {
      whatsapp_phone_number_id: localStorage.getItem('wa_phone_number_id') || '',
      whatsapp_access_token:    localStorage.getItem('wa_access_token')    || '',
      whatsapp_verify_token:    localStorage.getItem('wa_verify_token')    || '',
      ecom_url:                 localStorage.getItem('wa_ecom_url')        || ''
    };
  }

  /** Pull settings from backend into localStorage (called on login). */
  loadFromBackend(): void {
    this.http.get<{ [key: string]: string }>('/api/settings',
      { headers: this.headers() }).subscribe({
      next: (data) => {
        if (data['whatsappPhone'])              localStorage.setItem(K_WA, data['whatsappPhone']);
        if (data['whatsapp_phone_number_id'])   localStorage.setItem('wa_phone_number_id', data['whatsapp_phone_number_id']);
        if (data['whatsapp_access_token'])      localStorage.setItem('wa_access_token',    data['whatsapp_access_token']);
        if (data['whatsapp_verify_token'])      localStorage.setItem('wa_verify_token',    data['whatsapp_verify_token']);
        if (data['ecom_url'])                   localStorage.setItem('wa_ecom_url',        data['ecom_url']);
      },
      error: () => {}
    });
  }
}
