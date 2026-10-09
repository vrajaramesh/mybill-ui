import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, switchMap } from 'rxjs';
import { WholesaleService } from '../wholesale.service';
import { WholesaleCustomer } from '../wholesale.model';

/**
 * Customer selector for wholesale documents (quotation, credit invoice, sales receipt, debit note).
 * Usage: <app-wholesale-customer-picker [(customer)]="doc.customer" (createNew)="openCustomerForm()">
 * Searches active wholesale customers only; never shows retail customers.
 */
@Component({
  selector: 'app-wholesale-customer-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wholesale-customer-picker.component.html',
  styleUrls: ['../wholesale-shared.css', './wholesale-customer-picker.component.css']
})
export class WholesaleCustomerPickerComponent implements OnInit, OnDestroy {
  @Input() customer: WholesaleCustomer | null = null;
  @Input() label = 'Customer';
  @Input() required = true;
  /** Show the "+ New wholesale customer" entry (emits createNew). */
  @Input() allowCreate = true;
  @Output() customerChange = new EventEmitter<WholesaleCustomer | null>();
  @Output() createNew = new EventEmitter<void>();

  term = '';
  results: WholesaleCustomer[] = [];
  open = false;
  searching = false;
  private query$ = new Subject<string>();
  private sub?: Subscription;

  constructor(private wholesaleService: WholesaleService) { }

  ngOnInit(): void {
    this.sub = this.query$.pipe(
      debounceTime(250),
      switchMap(q => { this.searching = true; return this.wholesaleService.searchCustomers(q, '', true, 20); })
    ).subscribe({
      next: list => { this.results = list; this.searching = false; },
      error: () => { this.results = []; this.searching = false; }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onFocus(): void {
    this.open = true;
    this.query$.next(this.term.trim());
  }

  onInput(): void {
    this.open = true;
    this.query$.next(this.term.trim());
  }

  onBlur(): void {
    setTimeout(() => this.open = false, 200);
  }

  select(c: WholesaleCustomer): void {
    this.customer = c;
    this.customerChange.emit(c);
    this.term = '';
    this.open = false;
  }

  clear(): void {
    this.customer = null;
    this.customerChange.emit(null);
  }
}
