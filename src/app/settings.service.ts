import { Injectable } from '@angular/core';
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

  get firmName(): string     { return this._firmName$.getValue(); }
  get logo(): string         { return this._logo$.getValue(); }
  get gstNumber(): string    { return localStorage.getItem(K_GST)     || ''; }
  get address(): string      { return localStorage.getItem(K_ADDRESS) || ''; }
  get whatsappPhone(): string { return localStorage.getItem(K_WA)     || '8008152007'; }

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
    localStorage.setItem(K_WA, phone.trim());
  }
}
