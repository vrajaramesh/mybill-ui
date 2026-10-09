import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import {
  WholesaleCustomer, WholesaleCustomerMatch, WholesaleCustomerRequest, WholesaleOption
} from '../wholesale.model';
import { checkGstin, GstinCheck } from '../gstin';

type PanelMode = 'view' | 'edit' | 'create';

const PIN_PATTERN = /^[1-9][0-9]{5}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Wholesale customer list, details, add and edit. Independent of the retail customer module. */
@Component({
  selector: 'app-wholesale-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wholesale-customers.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-customers.component.css']
})
export class WholesaleCustomersComponent implements OnInit, OnDestroy {
  customers: WholesaleCustomer[] = [];
  customerTypes: WholesaleOption[] = [];
  states: WholesaleOption[] = [];
  loading = false;
  listError = '';

  searchTerm = '';
  typeFilter = '';
  statusFilter: 'ACTIVE' | 'ALL' = 'ACTIVE';
  private search$ = new Subject<void>();
  private searchSub?: Subscription;

  mode: PanelMode | null = null;
  selected: WholesaleCustomer | null = null;
  draft: WholesaleCustomerRequest = this.emptyDraft();
  formError = '';
  saving = false;
  /** Possible duplicates found before saving; user must confirm non-blocking ones. */
  duplicates: WholesaleCustomerMatch[] = [];
  duplicatesConfirmed = false;

  constructor(private wholesaleService: WholesaleService) { }

  ngOnInit(): void {
    this.wholesaleService.getCustomerOptions().subscribe({
      next: o => { this.customerTypes = o.customerTypes; this.states = o.states; },
      error: () => {}
    });
    this.searchSub = this.search$.pipe(debounceTime(300)).subscribe(() => this.load());
    this.load();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  onSearchChange(): void {
    this.search$.next();
  }

  load(): void {
    this.loading = true;
    this.wholesaleService.searchCustomers(this.searchTerm.trim(), this.typeFilter, this.statusFilter === 'ACTIVE').subscribe({
      next: data => {
        this.customers = data;
        this.loading = false;
        this.listError = '';
      },
      error: err => { this.loading = false; this.listError = 'Could not load wholesale customers: ' + (err.error?.message || err.message); }
    });
  }

  // ── Panel ────────────────────────────────────────────────

  view(customer: WholesaleCustomer): void {
    this.selected = customer;
    this.mode = 'view';
    this.formError = '';
  }

  startCreate(): void {
    this.selected = null;
    this.draft = this.emptyDraft();
    this.resetFormState();
    this.mode = 'create';
  }

  startEdit(customer: WholesaleCustomer): void {
    this.selected = customer;
    this.draft = {
      customerName: customer.customerName,
      businessName: customer.businessName || '',
      customerType: customer.customerType,
      gstNumber: customer.gstNumber || '',
      phone: customer.phone || '',
      email: customer.email || '',
      billingAddress: customer.billingAddress || '',
      city: customer.city || '',
      stateCode: customer.stateCode || '',
      pinCode: customer.pinCode || '',
      shippingSameAsBilling: customer.shippingSameAsBilling,
      shippingAddress: customer.shippingSameAsBilling ? '' : customer.shippingAddress || '',
      shippingCity: customer.shippingSameAsBilling ? '' : customer.shippingCity || '',
      shippingStateCode: customer.shippingSameAsBilling ? '' : customer.shippingStateCode || '',
      shippingPinCode: customer.shippingSameAsBilling ? '' : customer.shippingPinCode || '',
      notes: customer.notes || '',
      isActive: customer.isActive
    };
    this.resetFormState();
    this.mode = 'edit';
  }

  close(): void {
    this.mode = null;
    this.selected = null;
  }

  cancelEdit(): void {
    if (this.mode === 'edit' && this.selected) this.view(this.selected);
    else this.close();
  }

  private emptyDraft(): WholesaleCustomerRequest {
    return {
      customerName: '', businessName: '', customerType: 'RETAILER', gstNumber: '', phone: '', email: '',
      billingAddress: '', city: '', stateCode: '', pinCode: '', shippingSameAsBilling: true,
      shippingAddress: '', shippingCity: '', shippingStateCode: '', shippingPinCode: '', notes: '', isActive: true
    };
  }

  private resetFormState(): void {
    this.formError = '';
    this.duplicates = [];
    this.duplicatesConfirmed = false;
  }

  // ── GSTIN helpers ────────────────────────────────────────

  get gstin(): GstinCheck {
    return checkGstin(this.draft.gstNumber);
  }

  stateLabel(code?: string | null): string {
    return this.states.find(s => s.value === code)?.label || '';
  }

  /** Fill the billing state from a valid GSTIN when it is still empty. */
  onGstinChange(): void {
    this.duplicatesConfirmed = false;
    const check = this.gstin;
    if (check.stateCode && !this.draft.stateCode) this.draft.stateCode = check.stateCode;
  }

  get gstStateMismatch(): string {
    const code = this.gstin.stateCode;
    if (!code || !this.draft.stateCode || code === this.draft.stateCode) return '';
    return `GSTIN is registered in ${this.stateLabel(code) || code}, but the billing state is ${this.stateLabel(this.draft.stateCode)}.`;
  }

  // ── Save ─────────────────────────────────────────────────

  validate(): string {
    const d = this.draft;
    if (!d.customerName?.trim()) return 'Customer name is required.';
    if (!d.customerType) return 'Select a customer type.';
    if (this.gstin.error) return this.gstin.error;
    if (this.gstStateMismatch) return this.gstStateMismatch;
    const phoneDigits = (d.phone || '').replace(/[^0-9]/g, '');
    if (d.phone?.trim() && (phoneDigits.length < 10 || phoneDigits.length > 13)) return 'Phone number must contain 10 to 13 digits.';
    if (d.email?.trim() && !EMAIL_PATTERN.test(d.email.trim())) return 'Email address is not valid.';
    if (d.pinCode?.trim() && !PIN_PATTERN.test(d.pinCode.trim())) return 'Billing PIN code must be 6 digits.';
    if (!d.shippingSameAsBilling && d.shippingPinCode?.trim() && !PIN_PATTERN.test(d.shippingPinCode.trim()))
      return 'Shipping PIN code must be 6 digits.';
    return '';
  }

  save(): void {
    if (this.saving) return;
    this.formError = this.validate();
    if (this.formError) return;
    if (this.duplicatesConfirmed) { this.submit(); return; }

    const d = this.draft;
    this.saving = true;
    this.wholesaleService.findDuplicateCustomers((d.gstNumber || '').trim(), (d.phone || '').trim(), d.customerName.trim(),
      this.selected?.wholesaleCustomerId).subscribe({
      next: matches => {
        this.saving = false;
        this.duplicates = matches;
        const blocking = matches.find(m => m.blocking);
        if (blocking) {
          this.formError = `GST number ${blocking.gstNumber} is already registered for '${blocking.customerName}'` +
            (blocking.isActive ? '.' : ' (inactive — reactivate that customer instead).');
          return;
        }
        if (matches.length === 0) this.submit();
        // otherwise the template shows the warning with "Save anyway"
      },
      error: () => { this.saving = false; this.submit(); }
    });
  }

  confirmDuplicateAndSave(): void {
    this.duplicatesConfirmed = true;
    this.submit();
  }

  private submit(): void {
    const d = this.draft;
    const t = (s?: string) => (s || '').trim();
    const request: WholesaleCustomerRequest = {
      ...d,
      customerName: t(d.customerName), businessName: t(d.businessName), gstNumber: t(d.gstNumber).toUpperCase(),
      phone: t(d.phone), email: t(d.email), billingAddress: t(d.billingAddress), city: t(d.city),
      pinCode: t(d.pinCode), shippingAddress: t(d.shippingAddress), shippingCity: t(d.shippingCity),
      shippingPinCode: t(d.shippingPinCode), notes: t(d.notes)
    };
    const call = this.mode === 'edit' && this.selected
      ? this.wholesaleService.updateCustomer(this.selected.wholesaleCustomerId, request)
      : this.wholesaleService.createCustomer(request);
    this.saving = true;
    call.subscribe({
      next: saved => {
        this.saving = false;
        this.load();
        this.view(saved);
      },
      error: err => { this.saving = false; this.formError = err.error?.message || err.message; }
    });
  }

  toggleStatus(customer: WholesaleCustomer): void {
    this.startEdit(customer);
    this.draft.isActive = !customer.isActive;
    this.duplicatesConfirmed = true; // status change only; details already saved
    this.submit();
  }

  deleteCustomer(customer: WholesaleCustomer): void {
    if (!confirm(`Delete wholesale customer '${customer.customerName}'? This cannot be undone. Consider marking inactive instead.`)) return;
    this.wholesaleService.deleteCustomer(customer.wholesaleCustomerId).subscribe({
      next: () => { this.close(); this.load(); },
      error: err => this.formError = err.error?.message || err.message
    });
  }

  addressLines(address?: string | null, city?: string | null, state?: string | null, pin?: string | null): string[] {
    const lines = (address || '').split('\n').map(l => l.trim()).filter(Boolean);
    const place = [city, state].filter(Boolean).join(', ') + (pin ? ` - ${pin}` : '');
    if (place.trim()) lines.push(place.trim());
    return lines;
  }
}
