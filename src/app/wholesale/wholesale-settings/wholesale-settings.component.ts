import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import { SettingsService } from '../../settings.service';
import {
  WholesaleDocumentSettings,
  WholesaleBankDetails, WholesaleBusinessProfile, WholesaleDocumentProfile, WholesaleOption,
  WholesaleProfileDetails, WholesaleUpiDetails
} from '../wholesale.model';
import { checkGstin } from '../gstin';
import { sampleView, tradeDocumentHtml } from '../wholesale-trade-documents';

export type WholesaleSettingsSection = 'ws-profile' | 'ws-bank' | 'ws-upi' | 'ws-numbering';

const PIN_PATTERN = /^[1-9][0-9]{5}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_PATTERN = /^[0-9]{9,18}$/;
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.]{1,64}$/;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Wholesale → Business Profile / Bank Details / UPI Details / Document Types & Numbering.
 * Stored in the database (wholesale_business_profile), separate from the retail store details.
 */
@Component({
  selector: 'app-wholesale-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wholesale-settings.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-settings.component.css']
})
export class WholesaleSettingsComponent implements OnInit, OnChanges {
  @Input() section: WholesaleSettingsSection = 'ws-profile';

  active: WholesaleSettingsSection = 'ws-profile';
  profile: WholesaleBusinessProfile | null = null;
  states: WholesaleOption[] = [];
  loadError = '';

  details: WholesaleProfileDetails = this.emptyDetails();
  bank: WholesaleBankDetails = { bankName: '', accountName: '', accountNumber: '', ifsc: '', branch: '' };
  confirmAccountNumber = '';
  upi: WholesaleUpiDetails = { upiId: '', qrImageUrl: '', qrPublicId: '' };

  error = '';
  success = '';
  saving = false;
  uploading: 'logo' | 'qr' | null = null;
  previewHtml: SafeHtml | null = null;

  readonly numberingTypes = [
    { value: 'QUOTATION', label: 'Quotation' },
    { value: 'SALES_RECEIPT', label: 'Sales Receipt' },
    { value: 'CREDIT_NOTE', label: 'Credit Note' },
    { value: 'DEBIT_NOTE', label: 'Debit Note' }
  ];
  readonly gstClasses = [
    { value: 'TAX_INVOICE', label: 'Tax invoice' }, { value: 'BILL_OF_SUPPLY', label: 'Bill of supply' },
    { value: 'CREDIT_NOTE', label: 'GST credit note' }, { value: 'DEBIT_NOTE', label: 'GST debit note' },
    { value: 'RECEIPT_VOUCHER', label: 'Receipt voucher' }, { value: 'OTHER', label: 'Other / non-GST' }
  ];
  readonly referenceTypes = [
    { value: 'QUOTATION', label: 'Quotation' }, { value: 'SALES_RECEIPT', label: 'Sales Receipt' },
    { value: 'CREDIT_NOTE', label: 'Credit Note' }, { value: 'DEBIT_NOTE', label: 'Debit Note' }
  ];
  numberingDocType = 'QUOTATION';
  numbering: WholesaleDocumentSettings | null = null;
  numberingSaved: WholesaleDocumentSettings | null = null;

  constructor(private wholesaleService: WholesaleService, private retailSettings: SettingsService,
              private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
    this.loadNumbering();
    this.wholesaleService.getCustomerOptions().subscribe({ next: o => this.states = o.states, error: () => {} });
    this.wholesaleService.getBusinessProfile().subscribe({
      next: p => this.applyProfile(p),
      error: err => this.loadError = 'Could not load the wholesale business profile: ' + (err.error?.message || err.message)
    });
  }

  ngOnChanges(): void {
    this.select(this.section);
  }

  select(section: WholesaleSettingsSection): void {
    this.active = section;
    this.error = '';
    this.success = '';
  }

  private emptyDetails(): WholesaleProfileDetails {
    return { firmName: '', address: '', city: '', stateCode: '', pinCode: '', gstNumber: '', phone: '',
             email: '', website: '', logoUrl: '', logoPublicId: '' };
  }

  private applyProfile(p: WholesaleBusinessProfile): void {
    this.profile = p;
    this.details = p.details ? { ...this.emptyDetails(), ...this.blankNulls(p.details) } : this.emptyDetails();
    if (p.bank && p.bank.accountNumber) {
      this.bank = { ...this.blankNulls(p.bank) } as WholesaleBankDetails;
      this.confirmAccountNumber = p.bank.accountNumber;
    }
    if (p.upi && p.upi.upiId) this.upi = { ...this.blankNulls(p.upi) } as WholesaleUpiDetails;
    this.refreshPreview();
  }

  private blankNulls<T extends object>(o: T): T {
    const out: any = {};
    Object.entries(o).forEach(([k, v]) => out[k] = v ?? '');
    return out;
  }

  // ── Business profile ─────────────────────────────────────

  get gstin() { return checkGstin(this.details.gstNumber); }

  stateLabel(code?: string | null): string {
    return this.states.find(s => s.value === code)?.label || '';
  }

  onGstinChange(): void {
    const code = this.gstin.stateCode;
    if (code && !this.details.stateCode) this.details.stateCode = code;
    this.refreshPreview();
  }

  get retailDetailsAvailable(): boolean {
    return !!(this.retailSettings.firmName || this.retailSettings.gstNumber || this.retailSettings.address);
  }

  /** Read-only reuse of the retail store details (browser settings): fills empty fields only. */
  copyFromRetail(): void {
    if (!this.details.firmName) this.details.firmName = this.retailSettings.firmName;
    if (!this.details.gstNumber) this.details.gstNumber = this.retailSettings.gstNumber;
    if (!this.details.address) this.details.address = this.retailSettings.address;
    if (!this.details.phone && this.retailSettings.whatsappPhone) this.details.phone = this.retailSettings.whatsappPhone;
    this.onGstinChange();
    this.success = 'Copied from retail store details — review and save.';
  }

  validateDetails(): string {
    const d = this.details;
    if (!d.firmName?.trim()) return 'Firm name is required.';
    if (!d.address?.trim()) return 'Firm address is required.';
    if (!d.stateCode) return 'State is required.';
    if (!d.phone?.trim()) return 'Phone number is required.';
    const digits = d.phone.replace(/[^0-9]/g, '');
    if (digits.length < 10 || digits.length > 13) return 'Phone number must contain 10 to 13 digits.';
    if (d.pinCode?.trim() && !PIN_PATTERN.test(d.pinCode.trim())) return 'PIN code must be 6 digits.';
    if (this.gstin.error) return this.gstin.error;
    if (this.gstin.stateCode && this.gstin.stateCode !== d.stateCode)
      return `GST number is registered in ${this.stateLabel(this.gstin.stateCode)}, but the firm state is ${this.stateLabel(d.stateCode)}.`;
    if (d.email?.trim() && !EMAIL_PATTERN.test(d.email.trim())) return 'Email address is not valid.';
    if (d.website?.trim() && !WEBSITE_PATTERN.test(d.website.trim())) return 'Website must look like www.example.com.';
    return '';
  }

  saveDetails(): void {
    this.run(this.validateDetails(), () => this.wholesaleService.saveProfileDetails({
      ...this.details,
      gstNumber: (this.details.gstNumber || '').trim().toUpperCase()
    }), 'Business profile saved.');
  }

  // ── Bank ─────────────────────────────────────────────────

  get accountNumbersMismatch(): boolean {
    const a = (this.bank.accountNumber || '').replace(/\s/g, '');
    const b = (this.confirmAccountNumber || '').replace(/\s/g, '');
    return !!a && !!b && a !== b;
  }

  onIfscInput(): void {
    this.bank.ifsc = (this.bank.ifsc || '').toUpperCase().replace(/\s/g, '');
  }

  validateBank(): string {
    const b = this.bank;
    if (!b.bankName?.trim()) return 'Bank name is required.';
    if (!b.accountName?.trim()) return 'Account name is required.';
    const acct = (b.accountNumber || '').replace(/\s/g, '');
    if (!ACCOUNT_PATTERN.test(acct)) return 'Account number must be 9 to 18 digits.';
    if (acct !== (this.confirmAccountNumber || '').replace(/\s/g, '')) return 'Account numbers do not match.';
    if (!IFSC_PATTERN.test((b.ifsc || '').trim())) return 'IFSC must be 11 characters like SBIN0001234 (5th character is 0).';
    return '';
  }

  saveBank(): void {
    this.run(this.validateBank(), () => this.wholesaleService.saveBankDetails({
      ...this.bank, accountNumber: this.bank.accountNumber.replace(/\s/g, ''), ifsc: this.bank.ifsc.trim().toUpperCase()
    }), 'Bank details saved.');
  }

  removeBank(): void {
    if (!confirm('Remove bank details? Documents will no longer show bank transfer details.')) return;
    this.run('', () => this.wholesaleService.clearBankDetails(), 'Bank details removed.', () => {
      this.bank = { bankName: '', accountName: '', accountNumber: '', ifsc: '', branch: '' };
      this.confirmAccountNumber = '';
    });
  }

  // ── UPI ──────────────────────────────────────────────────

  validateUpi(): string {
    if (!UPI_PATTERN.test((this.upi.upiId || '').trim())) return 'UPI ID must look like name@bank (e.g. srisa@okhdfcbank).';
    return '';
  }

  saveUpi(): void {
    this.run(this.validateUpi(), () => this.wholesaleService.saveUpiDetails({ ...this.upi, upiId: this.upi.upiId.trim() }),
      'UPI details saved.');
  }

  removeUpi(): void {
    if (!confirm('Remove UPI details? Documents will no longer show UPI payment details.')) return;
    this.run('', () => this.wholesaleService.clearUpiDetails(), 'UPI details removed.', () => {
      this.upi = { upiId: '', qrImageUrl: '', qrPublicId: '' };
    });
  }

  // ── Document numbering ───────────────────────────────────

  get numberingLabel(): string {
    return this.numbering?.displayLabel || this.numberingTypes.find(t => t.value === this.numberingDocType)?.label || '';
  }

  get isSalesDocType(): boolean {
    return this.numberingDocType !== 'QUOTATION';
  }

  hasReferenceType(t: string): boolean {
    return (this.numbering?.allowedReferenceTypes || []).includes(t);
  }

  toggleReferenceType(t: string, on: boolean): void {
    if (!this.numbering) return;
    const set = new Set(this.numbering.allowedReferenceTypes || []);
    if (on) set.add(t); else set.delete(t);
    this.numbering.allowedReferenceTypes = Array.from(set);
  }

  loadNumbering(): void {
    this.numbering = null;
    this.error = '';
    this.success = '';
    this.wholesaleService.getDocumentSettings(this.numberingDocType).subscribe({
      next: s => this.applyNumbering(s),
      error: err => this.error = 'Could not load numbering settings: ' + (err.error?.message || err.message)
    });
  }

  private applyNumbering(s: WholesaleDocumentSettings): void {
    this.numberingSaved = s;
    this.numbering = { ...s, defaultTerms: s.defaultTerms || '', nextNumber: null };
  }

  /** Same rules as the server: prefix + sep + [FY + sep] + padded sequence; FY runs April–March. */
  get numberingPreview(): string {
    const n = this.numbering;
    if (!n) return '';
    const now = new Date();
    const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
    const samePeriod = !!this.numberingSaved && this.numberingSaved.resetEachFinancialYear === n.resetEachFinancialYear;
    const seq = n.nextNumber ? Number(n.nextNumber) : (samePeriod ? (this.numberingSaved!.lastNumber || 0) + 1 : 1);
    const padded = String(seq).padStart(Math.min(Math.max(Number(n.numberPadding) || 1, 1), 8), '0');
    return n.includeFinancialYear ? `${n.prefix}${n.separator}${fy}${n.separator}${padded}` : `${n.prefix}${n.separator}${padded}`;
  }

  validateNumbering(): string {
    const n = this.numbering;
    if (!n) return 'Numbering settings are not loaded.';
    if (!/^[A-Za-z0-9-]{1,20}$/.test(n.prefix || '')) return 'Prefix may use letters, digits and "-" (1–20 characters).';
    if (!(Number(n.numberPadding) >= 1 && Number(n.numberPadding) <= 8)) return 'Number of digits must be 1 to 8.';
    if (!(Number(n.defaultValidityDays) >= 1 && Number(n.defaultValidityDays) <= 365)) return 'Default validity must be 1 to 365 days.';
    if (!(Number(n.defaultDueDays ?? 0) >= 0 && Number(n.defaultDueDays ?? 0) <= 365)) return 'Default due days must be 0 to 365.';
    if (this.isSalesDocType) {
      if (!n.displayLabel?.trim()) return 'Enter the name used in the app.';
      if (!n.printTitle?.trim()) return 'Enter the printed title.';
      if (n.valueEffect === 'CREDIT' && n.stockEffect === 'OUT') return 'A credit document cannot take goods out of stock; choose "Back into stock" or "No change".';
      if (n.referenceMode !== 'NONE' && !(n.allowedReferenceTypes || []).length && n.referenceMode === 'REQUIRED')
        return 'Pick at least one document type that can be referenced (external invoices are always allowed).';
    }
    if (n.nextNumber !== null && n.nextNumber !== undefined && (n.nextNumber as any) !== '') {
      if (!(Number(n.nextNumber) >= 1)) return 'Next number must be at least 1.';
      const last = this.numberingSaved?.lastNumber || 0;
      if (Number(n.nextNumber) <= last && this.numberingSaved?.resetEachFinancialYear === n.resetEachFinancialYear)
        return `Next number must be greater than ${last}, the last number already used.`;
    }
    return '';
  }

  saveNumbering(): void {
    this.error = this.validateNumbering();
    this.success = '';
    if (this.error || this.saving || !this.numbering) return;
    const n = this.numbering;
    this.saving = true;
    this.wholesaleService.saveDocumentSettings({
      ...n,
      prefix: n.prefix.trim(),
      numberPadding: Number(n.numberPadding),
      defaultValidityDays: Number(n.defaultValidityDays),
      defaultDueDays: Number(n.defaultDueDays ?? 30),
      nextNumber: n.nextNumber ? Number(n.nextNumber) : null
    }, this.numberingDocType).subscribe({
      next: s => { this.saving = false; this.applyNumbering(s); this.success = `Numbering saved. Next ${this.numberingLabel}: ${s.nextNumberPreview}`; },
      error: err => {
        this.saving = false;
        this.error = err.status === 403 ? 'Only an admin can change numbering settings.' : (err.error?.message || err.message);
      }
    });
  }

  // ── Images ───────────────────────────────────────────────

  onImageSelected(event: Event, kind: 'logo' | 'qr'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { this.error = 'Please choose a PNG, JPG or WEBP image.'; return; }
    if (file.size > MAX_IMAGE_BYTES) { this.error = 'Image must be 2 MB or smaller.'; return; }
    this.error = '';
    this.uploading = kind;
    this.wholesaleService.uploadImage(file).subscribe({
      next: res => {
        this.uploading = null;
        if (kind === 'logo') { this.details.logoUrl = res.secure_url; this.details.logoPublicId = res.public_id; }
        else { this.upi.qrImageUrl = res.secure_url; this.upi.qrPublicId = res.public_id; }
        this.success = 'Image uploaded — click Save to keep it.';
        this.refreshPreview();
      },
      error: err => { this.uploading = null; this.error = 'Upload failed: ' + (err.error?.error || err.error?.message || err.message); }
    });
  }

  removeImage(kind: 'logo' | 'qr'): void {
    if (kind === 'logo') { this.details.logoUrl = ''; this.details.logoPublicId = ''; }
    else { this.upi.qrImageUrl = ''; this.upi.qrPublicId = ''; }
    this.success = 'Image removed — click Save to apply.';
    this.refreshPreview();
  }

  // ── Preview ──────────────────────────────────────────────

  /** Letterhead + payment block exactly as wholesale documents will print it, using the values on screen. */
  refreshPreview(): void {
    const d = this.details;
    const place = [d.city, this.stateLabel(d.stateCode)].filter(Boolean).join(', ') + (d.pinCode ? ` - ${d.pinCode}` : '');
    const profile: WholesaleDocumentProfile = {
      firmName: d.firmName || 'Your Firm Name',
      addressLines: [...(d.address || 'Firm address').split('\n').map(l => l.trim()).filter(Boolean), ...(place.trim() ? [place.trim()] : [])],
      stateCode: d.stateCode || '--',
      stateName: this.stateLabel(d.stateCode) || 'State',
      gstNumber: (d.gstNumber || '').toUpperCase() || null,
      phone: d.phone || '',
      email: d.email || null,
      website: d.website || null,
      logoUrl: d.logoUrl || null,
      bank: this.bank.bankName && this.bank.accountNumber ? { ...this.bank } : null,
      upi: this.upi.upiId ? { upiId: this.upi.upiId, payeeName: d.firmName, qrImageUrl: this.upi.qrImageUrl || null } : null
    };
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(tradeDocumentHtml(sampleView(profile)));
  }

  private run(validationError: string, call: () => Observable<WholesaleBusinessProfile>,
              successMessage: string, after?: () => void): void {
    this.error = validationError;
    this.success = '';
    if (this.error || this.saving) return;
    this.saving = true;
    call().subscribe({
      next: p => {
        this.saving = false;
        after?.();
        this.applyProfile(p);
        this.success = successMessage;
      },
      error: err => {
        this.saving = false;
        this.error = err.status === 403
          ? 'Only an admin can change the wholesale business profile.'
          : (err.error?.message || err.message);
      }
    });
  }
}
