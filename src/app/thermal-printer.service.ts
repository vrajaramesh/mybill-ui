import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

// Known BLE service / write-characteristic pairs for common thermal printers
const PROFILES = [
  // Most common in budget 80 mm BLE printers (POS-5890, RP80, etc.)
  { service: '000018f0-0000-1000-8000-00805f9b34fb',
    write:   '00002af1-0000-1000-8000-00805f9b34fb' },
  // Rongta / iDPRT and similar
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    write:   'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  // Nordic UART Service (used by some printers)
  { service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    write:   '6e400002-b5a3-f393-e0a9-e50e24dcca9e' },
  // Peripage / Paperang style
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    write:   '49535343-1e4d-4bd9-ba61-23c647249616' },
];

@Injectable({ providedIn: 'root' })
export class ThermalPrinterService {

  private device: any = null;
  private char: any = null;

  constructor(private settings: SettingsService) {}

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  get connected(): boolean {
    return this.device?.gatt?.connected === true && this.char !== null;
  }

  get deviceName(): string {
    return this.device?.name || '';
  }

  /** Show the browser device-picker and connect. Must be called from a user gesture. */
  async pair(): Promise<boolean> {
    if (!this.supported) return false;
    try {
      const bt = (navigator as any).bluetooth;
      this.device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: PROFILES.map(p => p.service),
      });
      return this._connect();
    } catch {
      return false;
    }
  }

  /** Silently reconnect to a previously paired device (no picker dialog). */
  async reconnect(): Promise<boolean> {
    if (!this.supported) return false;
    if (this.connected) return true;
    if (this.device) {
      const ok = await this._connect();
      if (ok) return true;
    }
    // Chrome 85+: auto-reconnect to any previously permitted device
    try {
      const bt = (navigator as any).bluetooth;
      if (typeof bt.getDevices === 'function') {
        const devices: any[] = await bt.getDevices();
        for (const d of devices) {
          this.device = d;
          const ok = await this._connect();
          if (ok) return true;
        }
      }
    } catch {}
    return false;
  }

  private async _connect(): Promise<boolean> {
    if (!this.device?.gatt) return false;
    try {
      const server = await this.device.gatt.connect();
      for (const p of PROFILES) {
        try {
          const svc  = await server.getPrimaryService(p.service);
          this.char  = await svc.getCharacteristic(p.write);
          return true;
        } catch {}
      }
      return false;
    } catch {
      return false;
    }
  }

  disconnect() {
    try { this.device?.gatt?.disconnect(); } catch {}
    this.char = null;
  }

  async printReceipt(bill: any): Promise<boolean> {
    if (!this.connected) {
      const ok = await this.reconnect();
      if (!ok) return false;
    }
    return this._send(this._buildEscPos(bill));
  }

  async printBoutiqueOrder(order: any): Promise<boolean> {
    if (!this.connected) {
      const ok = await this.reconnect();
      if (!ok) return false;
    }
    return this._send(this._buildBoutiqueEscPos(order));
  }

  private async _send(bytes: Uint8Array): Promise<boolean> {
    if (!this.char) return false;
    try {
      // BLE MTU is typically 20 bytes; send in small chunks
      const CHUNK = 20;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const slice = bytes.slice(i, i + CHUNK);
        try {
          await this.char.writeValueWithoutResponse(slice);
        } catch {
          await this.char.writeValue(slice);
        }
        // Small delay to avoid buffer overflow on cheap printers
        await new Promise(r => setTimeout(r, 20));
      }
      return true;
    } catch {
      this.char = null;
      return false;
    }
  }

  // ── ESC/POS builder ──────────────────────────────────────────────────────

  private _buildEscPos(bill: any): Uint8Array {
    const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
    const buf: number[] = [];

    const push  = (...b: number[]) => buf.push(...b);
    const ascii = (s: string) => {
      for (const c of s) push(c.charCodeAt(0) > 127 ? 63 : c.charCodeAt(0));
    };
    const line  = (s = '') => { ascii(s); push(LF); };
    const center = (s: string) => { push(ESC, 0x61, 1); line(s); push(ESC, 0x61, 0); };
    const bold  = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);
    const big   = (on: boolean) => push(GS, 0x21, on ? 0x11 : 0x00);

    const W   = 42; // chars per line for 80 mm paper
    const pad = (s: string, n: number) => s.substring(0, n).padEnd(n);
    const rjust = (s: string, n: number) => s.substring(0, n).padStart(n);
    const row = (left: string, right: string) => {
      const r = right.substring(0, 12);
      line(left.substring(0, W - r.length).padEnd(W - r.length) + r);
    };
    const dashes = () => line('-'.repeat(W));
    const dots   = () => line('. . . . . . . . . . . . . . . . . . . . .');

    // Initialise
    push(ESC, 0x40);

    // Header
    const firmName  = (this.settings.firmName  || 'SRISA FABRICS').toUpperCase();
    const gstNumber =  this.settings.gstNumber;
    const address   =  this.settings.address;
    big(true); bold(true); center(firmName); bold(false); big(false);
    if (gstNumber) center('GSTIN: ' + gstNumber);
    if (address) {
      address.split('\n').forEach(l => { if (l.trim()) center(l.trim().substring(0, W)); });
    }
    dashes();

    // Bill meta
    const dateStr = bill.billDate
      ? new Date(bill.billDate).toLocaleDateString('en-IN',
          { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    row('Bill # : ' + (bill.billNumber || ''), '');
    row('Date   : ' + dateStr,                 '');
    row('Pay    : ' + (bill.paymentMethod || ''), '');
    if (bill.customer?.customerName)
      row('Cust   : ' + (bill.customer.customerName || '').substring(0, 25), '');
    if (bill.customer?.phone)
      row('Phone  : ' + (bill.customer.phone || ''), '');
    dashes();

    // Column header
    bold(true);
    ascii(pad('#',  3)); ascii(pad('Item', 23));
    ascii(rjust('Qty', 7)); ascii(rjust('Amt', 8)); push(LF);
    bold(false);
    dots();

    // Items
    (bill.billItems || []).forEach((item: any, idx: number) => {
      const name = (item.product?.productName || item.itemDescription || '—').substring(0, 23);
      const qty  = Number(item.quantity).toFixed(1);
      const amt  = 'Rs' + Number(item.totalPrice || 0).toFixed(0);
      ascii(pad(String(idx + 1), 3));
      ascii(pad(name, 23));
      ascii(rjust(qty, 7));
      ascii(rjust(amt, 8));
      push(LF);
    });

    dots();

    // Totals
    row('Taxable Amt', 'Rs' + Number(bill.subtotal   || 0).toFixed(2));
    row('GST (5%)',    'Rs' + Number(bill.gstAmount   || 0).toFixed(2));
    dashes();
    big(true); bold(true);
    row('TOTAL', 'Rs' + Number(bill.totalAmount || 0).toFixed(0));
    bold(false); big(false);
    dashes();

    // Footer
    center('** Thank you! Visit Again! **');
    push(ESC, 0x61, 1);
    ascii(new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }));
    push(LF); push(ESC, 0x61, 0);

    // Feed and partial cut
    push(LF, LF, LF, LF);
    push(GS, 0x56, 0x42, 0x00);

    return new Uint8Array(buf);
  }

  private _buildBoutiqueEscPos(order: any): Uint8Array {
    const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
    const buf: number[] = [];

    const push   = (...b: number[]) => buf.push(...b);
    const ascii  = (s: string) => { for (const c of s) push(c.charCodeAt(0) > 127 ? 63 : c.charCodeAt(0)); };
    const line   = (s = '') => { ascii(s); push(LF); };
    const center = (s: string) => { push(ESC, 0x61, 1); line(s); push(ESC, 0x61, 0); };
    const bold   = (on: boolean) => push(ESC, 0x45, on ? 1 : 0);
    const big    = (on: boolean) => push(GS, 0x21, on ? 0x11 : 0x00);

    const W      = 42;
    const pad    = (s: string, n: number) => s.substring(0, n).padEnd(n);
    const rjust  = (s: string, n: number) => s.substring(0, n).padStart(n);
    const row    = (left: string, right: string) => {
      const r = right.substring(0, 14);
      line(left.substring(0, W - r.length).padEnd(W - r.length) + r);
    };
    const dashes = () => line('-'.repeat(W));
    const dots   = () => line('. . . . . . . . . . . . . . . . . . . . .');
    const fmtDate = (d: string) => d
      ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    push(ESC, 0x40); // init

    // Header
    const firmName  = (this.settings.firmName  || 'SRISA FABRICS').toUpperCase();
    const gstNumber =  this.settings.gstNumber;
    const address   =  this.settings.address;
    big(true); bold(true); center(firmName); bold(false); big(false);
    center('Boutique Stitching Bill');
    if (gstNumber) center('GSTIN: ' + gstNumber);
    if (address) {
      address.split('\n').forEach(l => { if (l.trim()) center(l.trim().substring(0, W)); });
    }
    dashes();

    // Order meta
    row('Order # : ' + (order.orderNumber || ''), '');
    row('Date    : ' + fmtDate(order.orderDate), '');
    row('Delivery: ' + fmtDate(order.deliveryDate), '');
    if (order.customer?.customerName)
      row('Cust    : ' + (order.customer.customerName || '').substring(0, 26), '');
    if (order.customer?.phone)
      row('Phone   : ' + (order.customer.phone || ''), '');
    dashes();

    // Column header
    bold(true);
    ascii(pad('#', 3));
    ascii(pad('Garment', 22));
    ascii(rjust('Qty', 5));
    ascii(rjust('Amt', 12));
    push(LF);
    bold(false);
    dots();

    // Items
    (order.items || []).forEach((item: any, idx: number) => {
      const name = (item.garmentType || '—').substring(0, 22);
      const qty  = 'x' + String(item.quantity || 1);
      const amt  = 'Rs ' + (Number(item.stitchingCharges || 0) * Number(item.quantity || 1)).toFixed(0);
      ascii(pad(String(idx + 1), 3));
      ascii(pad(name, 22));
      ascii(rjust(qty, 5));
      ascii(rjust(amt, 12));
      push(LF);
      if (item.fabricDescription) {
        line('   ' + item.fabricDescription.substring(0, 37));
      }
    });

    // Extra charges
    (order.extraCharges || []).forEach((ec: any) => {
      const desc = ('  ' + (ec.description || 'Extra charge')).substring(0, 27);
      const amt  = 'Rs ' + Number(ec.amount || 0).toFixed(0);
      ascii(pad(desc, 30));
      ascii(rjust(amt, 12));
      push(LF);
    });

    dots();

    // Totals
    row('Total Amount', 'Rs ' + Number(order.totalAmount || 0).toFixed(0));
    row('Advance Paid', 'Rs ' + Number(order.advancePaid || 0).toFixed(0));
    dashes();
    big(true); bold(true);
    row('BALANCE DUE', 'Rs ' + Number(order.balanceAmount || 0).toFixed(0));
    bold(false); big(false);
    dashes();

    if (order.notes) {
      line('Notes: ' + order.notes.substring(0, 35));
      push(LF);
    }

    // Footer
    center('Thank you! Collect with this bill.');
    push(ESC, 0x61, 1);
    ascii(new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }));
    push(LF); push(ESC, 0x61, 0);

    // Feed and cut
    push(LF, LF, LF, LF);
    push(GS, 0x56, 0x42, 0x00);

    return new Uint8Array(buf);
  }
}
