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
  // Nordic UART Service (used by many printers)
  { service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    write:   '6e400002-b5a3-f393-e0a9-e50e24dcca9e' },
  // Peripage / Paperang style
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    write:   '49535343-1e4d-4bd9-ba61-23c647249616' },
  // HM-10 / HM-11 BLE UART module — very common in cheap 58 mm label printers
  { service: '0000ffe0-0000-1000-8000-00805f9b34fb',
    write:   '0000ffe1-0000-1000-8000-00805f9b34fb' },
  // Niimbot label printers (B21, B3S, D11, D110, etc.)
  { service: '0000ff00-0000-1000-8000-00805f9b34fb',
    write:   '0000ff02-0000-1000-8000-00805f9b34fb' },
  // Generic / fallback used by some label printers
  { service: '0000fff0-0000-1000-8000-00805f9b34fb',
    write:   '0000fff2-0000-1000-8000-00805f9b34fb' },
  // BTLE-SPP used by some Xiamen / Goojprt printers
  { service: '0000ae00-0000-1000-8000-00805f9b34fb',
    write:   '0000ae01-0000-1000-8000-00805f9b34fb' },
];

@Injectable({ providedIn: 'root' })
export class ThermalPrinterService {

  // Receipt printer — used by billing & boutique modules
  private receiptDevice: any = null;
  private receiptChar: any = null;

  // Label printer — used for product labels
  private labelDevice: any = null;
  private labelChar: any = null;

  // DTPWeb SDK (SEZNIK JOSH / DothanTech printers via local Windows service)
  private _dtpApi: any = null;
  private _dtpPrinterName = localStorage.getItem('mybill_dtpweb_printer') || '';

  constructor(private settings: SettingsService) {}

  // ── DTPWeb SDK (local Windows service at 127.0.0.1:15216) ────────────────

  get dtpWebPrinterName(): string { return this._dtpPrinterName; }

  setDtpWebPrinterName(name: string): void {
    this._dtpPrinterName = name;
    localStorage.setItem('mybill_dtpweb_printer', name);
  }

  private _getDtpApi(): any {
    if (!this._dtpApi) {
      const dtpweb = (window as any).dtpweb;
      if (!dtpweb) { console.warn('[DTPWEB] dtpweb global not found — script not loaded?'); return null; }
      this._dtpApi = dtpweb.DTPWeb.getInstance();
    }
    return this._dtpApi;
  }

  async isDtpWebAvailable(): Promise<boolean> {
    const api = this._getDtpApi();
    if (!api) return false;
    try {
      const result = await api.checkPlugin();
      console.log('[DTPWEB] checkPlugin result:', !!result);
      return !!result;
    } catch (e: any) {
      console.warn('[DTPWEB] checkPlugin error:', e?.message ?? e);
      return false;
    }
  }

  async getDtpWebPrinters(): Promise<{ name: string; ip?: string; type?: number }[]> {
    const api = this._getDtpApi();
    if (!api) return [];
    try {
      await api.checkPlugin();
      const printers = await api.getPrinters({ onlyLocal: false });
      console.log('[DTPWEB] getPrinters result:', printers);
      return Array.isArray(printers) ? printers : [];
    } catch (e: any) {
      console.warn('[DTPWEB] getPrinters error:', e?.message ?? e);
      return [];
    }
  }

  private async _printLabelDtpWeb(product: any): Promise<boolean> {
    const api = this._getDtpApi();
    if (!api) return false;

    try {
      const available = await api.checkPlugin();
      if (!available) {
        console.warn('[DTPWEB] Service not available at 127.0.0.1:15216 — install DTPWeb-Inst on this PC');
        return false;
      }

      let printerName = this._dtpPrinterName;
      if (!printerName) {
        const printers = await api.getPrinters({ onlyLocal: true });
        if (!Array.isArray(printers) || printers.length === 0) {
          console.warn('[DTPWEB] No printers found');
          return false;
        }
        printerName = printers[0].name;
        console.log('[DTPWEB] Auto-selected first printer:', printerName);
      }

      const clean = (s: string, max: number) => (s || '').replace(/["\r\n\\]/g, '').substring(0, max);
      const name     = clean(product.productName || 'Product', 22);
      const code     = String(product.productId || '').padStart(6, '0');
      const price    = product.sellingPrice != null ? 'Rs.' + Number(product.sellingPrice).toFixed(0) : '';
      const firmName = clean((this.settings.firmName || 'STORE').toUpperCase(), 20);
      const category = clean(product.category?.categoryName || '', 20);

      const labelWidth  = 50; // mm
      const labelHeight = 40; // mm
      const barcodeY    = category ? 18 : 13;

      const page: any[] = [
        { type: 'text', text: firmName, x: 1, y: 1,  width: 48, height: 5,  fontHeight: 3.5, fontStyle: 1 },
        { type: 'text', text: name,     x: 1, y: 7,  width: 48, height: 5,  fontHeight: 3.5 },
      ];
      if (category) {
        page.push({ type: 'text', text: category, x: 1, y: 13, width: 48, height: 4, fontHeight: 3 });
      }
      page.push({ type: 'barcode', text: code, x: 1, y: barcodeY, width: 46, height: 9, textHeight: 3 });
      if (price) {
        page.push({ type: 'text', text: price, x: 1, y: barcodeY + 13, width: 48, height: 6, fontHeight: 5, fontStyle: 1 });
      }

      console.log('[DTPWEB] ══ REQUEST ════════════════════════════════');
      console.log('[DTPWEB]   printer     :', printerName);
      console.log('[DTPWEB]   label size  :', labelWidth + 'x' + labelHeight + ' mm');
      console.log('[DTPWEB]   firmName    :', firmName);
      console.log('[DTPWEB]   productName :', name);
      console.log('[DTPWEB]   code        :', code);
      console.log('[DTPWEB]   price       :', price);
      console.log('[DTPWEB]   category    :', category);
      console.log('[DTPWEB]   barcodeY    :', barcodeY, 'mm');
      console.log('[DTPWEB]   page items  :', JSON.stringify(page));
      console.log('[DTPWEB] ═══════════════════════════════════════════');

      const t0 = Date.now();
      const result = await api.print({
        action: 0x1000,   // Print directly
        printerInfo: { printerName },
        jobInfo: { jobWidth: labelWidth, jobHeight: labelHeight, orientation: 0 },
        jobPages: [page],
      });

      console.log('[DTPWEB] ══ RESPONSE ═══════════════════════════════');
      console.log('[DTPWEB]   elapsed :', (Date.now() - t0) + 'ms');
      console.log('[DTPWEB]   result  :', JSON.stringify(result));
      console.log('[DTPWEB] ═══════════════════════════════════════════');

      return true;
    } catch (e: any) {
      console.error('[DTPWEB] print failed:', e?.message ?? e);
      return false;
    }
  }

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // ── Receipt printer ───────────────────────────────────────────────────────

  get receiptConnected(): boolean {
    return this.receiptDevice?.gatt?.connected === true && this.receiptChar !== null;
  }

  get receiptDeviceName(): string {
    return this.receiptDevice?.name || '';
  }

  async pairReceipt(): Promise<string | null> {
    if (!this.supported) return null;
    try {
      const bt = (navigator as any).bluetooth;
      this.receiptDevice = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: PROFILES.map(p => p.service),
      });
    } catch {
      return null; // user dismissed the picker — not an error
    }
    return this._connectDevice(this.receiptDevice, 'receipt');
  }

  async reconnectReceipt(): Promise<boolean> {
    if (!this.supported) return false;
    if (this.receiptConnected) return true;
    if (this.receiptDevice) {
      const ok = await this._connectDevice(this.receiptDevice, 'receipt');
      if (ok) return true;
    }
    try {
      const bt = (navigator as any).bluetooth;
      if (typeof bt.getDevices === 'function') {
        const devices: any[] = await bt.getDevices();
        for (const d of devices) {
          this.receiptDevice = d;
          const ok = await this._connectDevice(d, 'receipt');
          if (ok) return true;
        }
      }
    } catch {}
    return false;
  }

  disconnectReceipt(): void {
    try { this.receiptDevice?.gatt?.disconnect(); } catch {}
    this.receiptChar = null;
  }

  // ── Label printer ─────────────────────────────────────────────────────────

  get labelConnected(): boolean {
    return this.labelDevice?.gatt?.connected === true && this.labelChar !== null;
  }

  get labelDeviceName(): string {
    return this.labelDevice?.name || '';
  }

  async pairLabel(): Promise<string | null> {
    if (!this.supported) return null;
    try {
      const bt = (navigator as any).bluetooth;
      this.labelDevice = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: PROFILES.map(p => p.service),
      });
    } catch {
      return null; // user dismissed the picker — not an error
    }
    return this._connectDevice(this.labelDevice, 'label');
  }

  async reconnectLabel(): Promise<boolean> {
    if (!this.supported) { console.warn('[LABEL] BLE not supported'); return false; }
    if (this.labelConnected) { console.log('[LABEL] Already connected'); return true; }
    if (this.labelDevice) {
      console.log('[LABEL] reconnectLabel: trying saved device "%s"', this.labelDevice.name);
      const err = await this._connectDevice(this.labelDevice, 'label');
      if (!err) { console.log('[LABEL] reconnected successfully'); return true; }
      console.warn('[LABEL] reconnect failed: %s', err);
    } else {
      console.warn('[LABEL] reconnectLabel: no saved labelDevice — user must pair first');
    }
    return false;
  }

  disconnectLabel(): void {
    try { this.labelDevice?.gatt?.disconnect(); } catch {}
    this.labelChar = null;
  }

  // ── Internal connection ───────────────────────────────────────────────────

  private async _connectDevice(device: any, type: 'receipt' | 'label'): Promise<string | null> {
    if (!device?.gatt) return 'Device has no GATT interface.';
    console.log('[BLE] Connecting to "%s" (type=%s)...', device.name, type);
    let server: any;
    try {
      server = await device.gatt.connect();
      console.log('[BLE] GATT connected to "%s"', device.name);
    } catch (e: any) {
      console.error('[BLE] GATT connect failed for "%s": %s', device.name, e?.message ?? e);
      return `Could not connect to "${device.name || 'printer'}" via Bluetooth.\n` +
        'Make sure the printer is powered on and not connected to another device.\n' +
        (e?.message ? `Detail: ${e.message}` : '');
    }

    for (const p of PROFILES) {
      try {
        const svc  = await server.getPrimaryService(p.service);
        const char = await svc.getCharacteristic(p.write);
        if (type === 'receipt') this.receiptChar = char;
        else this.labelChar = char;
        console.log('[BLE] Matched profile — service=%s write=%s', p.service, p.write);
        return null; // success
      } catch {
        console.log('[BLE] Profile not matched: service=%s', p.service);
      }
    }

    // Connected to GATT but no matching service found — show diagnostic help
    const name = device.name || 'your printer';
    console.error('[BLE] No matching profile found for "%s"', name);
    return `Connected to "${name}" but could not find a supported print service.\n\n` +
      'This usually means the printer uses a non-standard BLE profile.\n\n' +
      'What to try:\n' +
      '• Open "nRF Connect" or "BLE Scanner" app on your phone, connect to the printer, ' +
        'and share the Service UUID with us so we can add support.\n' +
      '• Common unsupported models: Zebra, Brother P-touch, DYMO — these need USB/Wi-Fi.';
  }

  // ── Print methods ─────────────────────────────────────────────────────────

  async printReceipt(bill: any): Promise<boolean> {
    if (!this.receiptConnected) {
      const ok = await this.reconnectReceipt();
      if (!ok) return false;
    }
    return this._send(this.receiptChar, this._buildEscPos(bill));
  }

  async printBoutiqueOrder(order: any): Promise<boolean> {
    if (!this.receiptConnected) {
      const ok = await this.reconnectReceipt();
      if (!ok) return false;
    }
    return this._send(this.receiptChar, this._buildBoutiqueEscPos(order));
  }

  async printLabel(product: any): Promise<boolean> {
    console.log('[LABEL] printLabel called — labelConnected=%s labelDevice=%s labelChar=%s',
      this.labelConnected, this.labelDevice?.name ?? 'null', this.labelChar ? 'set' : 'null');

    // Try DTPWeb SDK first (SEZNIK JOSH / DothanTech printers via Windows service)
    const dtpResult = await this._printLabelDtpWeb(product);
    if (dtpResult) {
      console.log('[LABEL] Printed via DTPWeb SDK successfully');
      return true;
    }
    console.log('[LABEL] DTPWeb not available — falling back to BLE TSPL...');

    // Fall back to BLE TSPL
    if (!this.labelConnected) {
      console.log('[LABEL] Not connected — attempting reconnectLabel...');
      const ok = await this.reconnectLabel();
      console.log('[LABEL] reconnectLabel result:', ok,
        '| labelChar after:', this.labelChar ? 'set' : 'null');
      if (!ok) { console.error('[LABEL] reconnectLabel failed — aborting print'); return false; }
    }

    const tspl = this._buildLabelTspl(product);
    const tsplText = new TextDecoder().decode(tspl);
    console.log('[LABEL] TSPL bytes:', tspl.length,
      '\n[LABEL] TSPL content:\n' + tsplText);

    const result = await this._send(this.labelChar, tspl);
    console.log('[LABEL] _send result:', result);
    return result;
  }

  private async _send(char: any, bytes: Uint8Array): Promise<boolean> {
    if (!char) { console.error('[BLE-SEND] char is null — cannot send'); return false; }
    console.log('[BLE-SEND] Starting send: totalBytes=%d', bytes.length);

    // Negotiate the largest MTU the device supports by trying descending sizes.
    // Web Bluetooth throws if the chunk exceeds negotiated ATT_MTU.
    const CANDIDATES = [512, 200, 100, 64, 20];
    let chunkSize = 20;
    for (const size of CANDIDATES) {
      try {
        const probe = bytes.slice(0, Math.min(size, bytes.length));
        await (char.writeValueWithoutResponse
          ? char.writeValueWithoutResponse(probe)
          : char.writeValue(probe));
        chunkSize = size;
        bytes = bytes.slice(probe.length); // remaining bytes after probe
        console.log('[BLE-SEND] MTU probe succeeded at size=%d — remaining=%d bytes', size, bytes.length);
        break;
      } catch (e: any) {
        console.warn('[BLE-SEND] MTU probe failed at size=%d: %s', size, e?.message ?? e);
        if (size === 20) {
          console.error('[BLE-SEND] Even 20-byte probe failed — aborting');
          return false;
        }
      }
    }

    try {
      let chunkCount = 0;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const slice = bytes.slice(i, i + chunkSize);
        try {
          await char.writeValueWithoutResponse(slice);
        } catch (e1: any) {
          console.warn('[BLE-SEND] writeValueWithoutResponse failed chunk %d: %s — retrying with writeValue', chunkCount, e1?.message ?? e1);
          await char.writeValue(slice);
        }
        chunkCount++;
        await new Promise(r => setTimeout(r, 10));
      }
      console.log('[BLE-SEND] Done — sent %d chunks at chunkSize=%d', chunkCount + 1, chunkSize);
      return true;
    } catch (e: any) {
      console.error('[BLE-SEND] Send failed:', e?.message ?? e);
      if (char === this.receiptChar) this.receiptChar = null;
      if (char === this.labelChar) this.labelChar = null;
      return false;
    }
  }

  // ── ESC/POS builders ──────────────────────────────────────────────────────

  // TSPL label builder for iDPRT SP426 and other TSPL-compatible label printers.
  // iDPRT SP426: 203 DPI, 50 mm wide labels. TSPL coordinates are in dots (1 dot ≈ 0.125 mm).
  private _buildLabelTspl(product: any): Uint8Array {
    const clean = (s: string, max: number) =>
      (s || '').replace(/["\r\n\\]/g, '').substring(0, max);

    const name     = clean(product.productName || 'Product', 20);
    const code     = String(product.productId || '').padStart(6, '0');
    const price    = product.sellingPrice != null
      ? 'Rs.' + Number(product.sellingPrice).toFixed(0)
      : '';
    const firmName = clean((this.settings.firmName || 'STORE').toUpperCase(), 18);
    const category = clean(product.category?.categoryName || '', 20);

    const lines: string[] = [
      'SIZE 50 mm,40 mm',   // label size: 50 mm wide × 40 mm tall
      'GAP 3 mm,0',         // gap between labels
      'DIRECTION 0',
      'SPEED 4',
      'DENSITY 8',
      'CLS',
      // Firm name — font "2"
      `TEXT 5,5,"2",0,1,1,"${firmName}"`,
      // Product name — font "3"
      `TEXT 5,35,"3",0,1,1,"${name}"`,
    ];

    if (category) {
      lines.push(`TEXT 5,68,"2",0,1,1,"${category}"`);
    }

    // Barcode — Code128, 50 dots tall, human-readable below (adds ~30 dots)
    const barcodeY = category ? 95 : 68;
    lines.push(`BARCODE 5,${barcodeY},"128",50,1,0,2,2,"${code}"`);

    // Price — placed 85 dots below barcode start to clear the human-readable text
    if (price) {
      lines.push(`TEXT 5,${barcodeY + 85},"4",0,1,1,"${price}"`);
    }

    lines.push('PRINT 1', '');

    return new TextEncoder().encode(lines.join('\r\n'));
  }

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
