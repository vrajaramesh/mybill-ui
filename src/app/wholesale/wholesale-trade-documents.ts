import {
  WholesaleDocumentProfile, WholesaleQuotation, WholesaleQuotationCustomer, WholesaleQuotationTotals, WholesaleSalesDocument
} from './wholesale.model';
import { escapeHtml } from './wholesale-document-template';

/**
 * Professional wholesale document templates (Quotation, Sales Receipt, Credit Note, Debit Note).
 *
 * One view model (TradeDocView) feeds three outputs so they always agree:
 *   - tradeDocumentHtml()   A4 print + in-app preview (repeating table header, page numbers via @page)
 *   - compactDocumentHtml() 80 mm thermal / compact print
 *   - wholesale-document-pdf.ts  native jsPDF A4 PDF (text-based, paginated)
 * Only each document's saved snapshots are used — never live customer, product or price data.
 * Retail bill/receipt templates are separate and unchanged.
 */

export interface TradeLine {
  lineNo: number; itemName: string; productCode?: string | null; description?: string | null; hsnCode?: string | null;
  quantity: number; unit: string; rate: number; discountPct: number; taxableAmount: number; gstPct: number;
  cgstAmount: number; sgstAmount: number; igstAmount: number; gstAmount: number; totalAmount: number;
}

export interface MetaRow { label: string; value: string; }

export interface TradePayment {
  statusLabel: string;
  method?: string | null;
  paid: number;
  balance: number;
  dueDate?: string | null;
  history: { date: string; method: string; reference?: string | null; amount: number }[];
}

export interface TradeDocView {
  kind: 'QUOTATION' | 'SALES_RECEIPT' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  title: string;
  numberLabel: string;
  number: string;
  date: string;
  meta: MetaRow[];
  watermark?: string | null;
  firm: WholesaleDocumentProfile;
  customer: WholesaleQuotationCustomer;
  interstate: boolean;
  items: TradeLine[];
  totals: WholesaleQuotationTotals;
  notes?: string | null;
  terms?: string | null;
  reason?: string | null;
  /** Sales documents that the customer pays. */
  payment?: TradePayment | null;
  /** Credit documents: amount credited to the customer. */
  creditAmount?: number | null;
  /** Show bank / UPI details (something is payable). */
  showBankUpi: boolean;
  amountDue: number;
  /** Line under the signature on the left. */
  receiverLabel: string;
}

export interface HsnSummaryRow {
  hsn: string; gstPct: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number;
}

// ── Formatting ─────────────────────────────────────────────

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n: number) => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
const below1000 = (n: number) => [Math.floor(n / 100) ? ONES[Math.floor(n / 100)] + ' Hundred' : '', n % 100 ? below100(n % 100) : '']
  .filter(Boolean).join(' ');

/** Indian numbering: 125430.50 → "Rupees One Lakh Twenty Five Thousand Four Hundred Thirty and Fifty Paise Only". */
export function amountInWords(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100);
  let rupees = Math.floor(rounded / 100);
  const paise = rounded % 100;
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(below1000(crore) + ' Crore');
  if (lakh) parts.push(below100(lakh) + ' Lakh');
  if (thousand) parts.push(below100(thousand) + ' Thousand');
  if (rupees) parts.push(below1000(rupees));
  return (parts.length ? 'Rupees ' + parts.join(' ') : 'Rupees Zero') + (paise ? ' and ' + below100(paise) + ' Paise' : '') + ' Only';
}

export const money = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const qty = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 });
export const pct = (n: number) => `${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank transfer', CARD: 'Card', CHEQUE: 'Cheque'
};
export function paymentModeLabel(mode?: string | null): string {
  return mode ? PAYMENT_MODE_LABELS[mode] || mode : '';
}

const SALES_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', ISSUED: 'Unpaid', PARTIALLY_PAID: 'Partially paid', PAID: 'Paid', CANCELLED: 'Cancelled'
};
export function salesStatusLabel(status: string): string {
  return SALES_STATUS_LABELS[status] || status;
}

const NUMBER_LABELS: Record<string, string> = {
  TAX_INVOICE: 'Invoice No.', BILL_OF_SUPPLY: 'Bill No.', CREDIT_NOTE: 'Note No.', DEBIT_NOTE: 'Note No.',
  RECEIPT_VOUCHER: 'Voucher No.', OTHER: 'Document No.'
};

export function placeOfSupply(c: WholesaleQuotationCustomer): string {
  const name = c.shippingStateName || c.billingStateName;
  const code = c.shippingStateCode || c.billingStateCode;
  return name ? `${name}${code ? ' (' + code + ')' : ''}` : '—';
}

export function addressLines(address?: string | null, city?: string | null, state?: string | null, pin?: string | null): string[] {
  const lines = (address || '').split('\n').map(l => l.trim()).filter(Boolean);
  const place = [city, state].filter(Boolean).join(', ') + (pin ? ` - ${pin}` : '');
  if (place.trim()) lines.push(place.trim());
  return lines;
}

/** GST invoice-style HSN/SAC summary (taxable + tax per HSN and rate). */
export function hsnSummary(v: TradeDocView): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();
  for (const i of v.items) {
    const key = `${i.hsnCode || '—'}|${Number(i.gstPct)}`;
    const row = map.get(key) || { hsn: i.hsnCode || '—', gstPct: Number(i.gstPct), taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
    row.taxable += Number(i.taxableAmount);
    row.cgst += Number(i.cgstAmount);
    row.sgst += Number(i.sgstAmount);
    row.igst += Number(i.igstAmount);
    row.totalTax += Number(i.gstAmount);
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => a.hsn.localeCompare(b.hsn) || a.gstPct - b.gstPct);
}

// ── View models ────────────────────────────────────────────

export function quotationView(q: WholesaleQuotation): TradeDocView {
  return {
    kind: 'QUOTATION', title: 'QUOTATION', numberLabel: 'Quotation No.', number: q.displayNumber, date: q.quotationDate,
    meta: [
      { label: 'Valid Until', value: fmtDate(q.validUntil) },
      { label: 'Place of Supply', value: placeOfSupply(q.customer) }
    ],
    watermark: q.status === 'DRAFT' || q.status === 'CANCELLED' ? q.status : null,
    firm: q.firm, customer: q.customer, interstate: q.interstate, items: q.items, totals: q.totals,
    notes: q.notes, terms: q.terms, payment: null, creditAmount: null,
    showBankUpi: true, amountDue: Number(q.totals.grandTotal), receiverLabel: 'Accepted by (customer)'
  };
}

export function salesDocumentView(d: WholesaleSalesDocument): TradeDocView {
  const credit = d.semantics?.valueEffect === 'CREDIT';
  const ref = d.reference;
  const meta: MetaRow[] = [];
  if (ref) meta.push({ label: ref.docType === 'QUOTATION' ? 'Quotation Ref.' : 'Against Invoice',
                       value: ref.number + (ref.date ? ` dt. ${fmtDate(ref.date)}` : '') });
  if (!credit && d.payment.dueDate) meta.push({ label: 'Due Date', value: fmtDate(d.payment.dueDate) });
  meta.push({ label: 'Place of Supply', value: placeOfSupply(d.customer) });
  meta.push({ label: 'Reverse Charge', value: 'No' });
  const recorded = (d.payments || []).filter(p => p.status === 'RECORDED');
  const balance = credit ? 0 : Number(d.payment.balanceDue);
  return {
    kind: d.docType, title: d.printTitle,
    numberLabel: d.docType === 'SALES_RECEIPT' ? 'Receipt No.' : (NUMBER_LABELS[d.semantics?.gstClassification] || 'Document No.'),
    number: d.documentNumber, date: d.documentDate, meta,
    watermark: d.status === 'CANCELLED' || d.status === 'DRAFT' ? d.status : null,
    firm: d.firm, customer: d.customer, interstate: d.interstate, items: d.items, totals: d.totals,
    notes: d.notes, terms: d.terms, reason: d.reason,
    payment: credit ? null : {
      statusLabel: salesStatusLabel(d.status), method: paymentModeLabel(d.payment.paymentMode), paid: Number(d.payment.amountPaid),
      balance, dueDate: d.payment.dueDate,
      history: recorded.map(p => ({ date: p.paymentDate, method: paymentModeLabel(p.paymentMode), reference: p.reference, amount: Number(p.amount) }))
    },
    creditAmount: credit ? Number(d.totals.grandTotal) : null,
    showBankUpi: !credit && balance > 0 && d.status !== 'CANCELLED',
    amountDue: balance,
    receiverLabel: "Receiver's signature"
  };
}

/** Letterhead-only sample (Settings preview). */
export function sampleView(firm: WholesaleDocumentProfile): TradeDocView {
  const item: TradeLine = { lineNo: 1, itemName: 'Sample cotton fabric', productCode: 'SMP-01', description: '58 inch, blue checks',
    hsnCode: '5208', quantity: 50, unit: 'Meters', rate: 72, discountPct: 0, taxableAmount: 3600, gstPct: 5,
    cgstAmount: 90, sgstAmount: 90, igstAmount: 0, gstAmount: 180, totalAmount: 3780 };
  return {
    kind: 'SALES_RECEIPT', title: 'TAX INVOICE (PREVIEW)', numberLabel: 'Invoice No.', number: 'SR-000001',
    date: new Date().toLocaleDateString('en-CA'), meta: [{ label: 'Place of Supply', value: firm.stateName ? `${firm.stateName} (${firm.stateCode})` : '—' }],
    firm, interstate: false, items: [item],
    customer: { wholesaleCustomerId: 0, customerName: 'Sample Customer', businessName: 'Sample Traders', gstNumber: null,
      phone: '+91 90000 00000', billingAddress: '12 Market Street', billingStateName: firm.stateName,
      billingStateCode: firm.stateCode, shippingAddress: '12 Market Street', shippingStateName: firm.stateName, shippingStateCode: firm.stateCode },
    totals: { grossAmount: 3600, discountAmount: 0, subtotal: 3600, otherChargesAmount: 0, otherChargesGstPct: 0,
      otherChargesGstAmount: 0, cgstAmount: 90, sgstAmount: 90, igstAmount: 0, gstAmount: 180, roundOff: 0, grandTotal: 3780 },
    terms: 'Your default terms and conditions appear here.', payment: null, creditAmount: null,
    showBankUpi: true, amountDue: 3780, receiverLabel: "Receiver's signature"
  };
}

// ── A4 HTML (print + preview) ──────────────────────────────

const safeImg = (url?: string | null) => url && /^https:\/\//i.test(url) ? escapeHtml(url) : null;

const cssString = (text: string) => '"' + text.replace(/[\\"\n\r<>]/g, ' ') + '"';

/** Page numbers + footer on every printed page (Chrome/Edge 131+ print @page margin boxes). */
const a4Styles = (footer: string) => `
  @page { size: A4; margin: 12mm 10mm 16mm 10mm;
    @bottom-left { content: ${cssString(footer)}; font: 8px Arial, sans-serif; color: #777; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px Arial, sans-serif; color: #777; } }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 14px; font: 11px/1.4 'Segoe UI', Arial, Helvetica, sans-serif; color: #1f2933; background: #fff; }
  .doc { max-width: 190mm; margin: 0 auto; position: relative; }
  .hdr { display: flex; gap: 14px; align-items: flex-start; padding-bottom: 10px; border-bottom: 3px solid #1f3a5f; }
  .hdr .logo { max-height: 64px; max-width: 150px; object-fit: contain; }
  .hdr .firm { flex: 1; }
  .hdr .firm-name { font-size: 20px; font-weight: 700; color: #1f3a5f; letter-spacing: .3px; }
  .hdr .line { color: #4a5563; }
  .hdr .gst { margin-top: 3px; font-weight: 600; color: #1f2933; }
  .titlebox { text-align: right; min-width: 170px; }
  .titlebox .title { font-size: 16px; font-weight: 800; color: #1f3a5f; letter-spacing: 1px; }
  .titlebox .orig { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-top: 10px; border: 1px solid #cbd2d9; }
  .meta div { display: flex; padding: 4px 8px; border-bottom: 1px solid #e4e7eb; }
  .meta div:nth-child(odd) { border-right: 1px solid #e4e7eb; }
  .meta span { color: #6b7280; min-width: 92px; }
  .meta strong { font-weight: 600; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #cbd2d9; border-top: 0; }
  .party { padding: 7px 9px; }
  .party + .party { border-left: 1px solid #cbd2d9; }
  .party h4 { margin: 0 0 3px; font-size: 9px; letter-spacing: .6px; text-transform: uppercase; color: #1f3a5f; }
  .party .name { font-weight: 700; font-size: 12px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.items thead { display: table-header-group; }
  table.items th { background: #1f3a5f; color: #fff; font-size: 9.5px; font-weight: 600; padding: 5px 4px; text-align: left; border: 1px solid #1f3a5f; }
  table.items td { padding: 5px 4px; border: 1px solid #cbd2d9; vertical-align: top; }
  table.items tr { page-break-inside: avoid; }
  table.items tbody tr:nth-child(even) td { background: #f7f9fb; }
  table.items .n { text-align: right; white-space: nowrap; }
  table.items .c { text-align: center; }
  table.items tfoot td { font-weight: 700; background: #eef2f7; }
  .desc { color: #6b7280; font-size: 10px; }
  .lower { display: grid; grid-template-columns: 1.35fr 1fr; gap: 12px; margin-top: 10px; page-break-inside: avoid; }
  .words { border: 1px solid #cbd2d9; padding: 6px 8px; }
  .words b { color: #1f3a5f; }
  table.hsn { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; }
  table.hsn th, table.hsn td { border: 1px solid #cbd2d9; padding: 3px 4px; }
  table.hsn th { background: #eef2f7; text-align: left; }
  table.hsn .n { text-align: right; }
  table.totals { width: 100%; border-collapse: collapse; }
  table.totals td { padding: 4px 8px; border-bottom: 1px solid #e4e7eb; }
  table.totals td:last-child { text-align: right; white-space: nowrap; }
  table.totals .grand td { background: #1f3a5f; color: #fff; font-size: 14px; font-weight: 800; border: 0; }
  .note { margin-top: 8px; padding: 6px 8px; border-left: 3px solid #1f3a5f; background: #f7f9fb; }
  .pay { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 12px; page-break-inside: avoid; }
  .box { border: 1px solid #cbd2d9; padding: 7px 9px; }
  .box h4 { margin: 0 0 4px; font-size: 9px; letter-spacing: .6px; text-transform: uppercase; color: #1f3a5f; }
  .box table td { padding: 1px 6px 1px 0; }
  .box table td:first-child { color: #6b7280; }
  .qr { width: 96px; height: 96px; object-fit: contain; border: 1px solid #e4e7eb; float: right; margin-left: 6px; }
  .paid { color: #0f6b3a; font-weight: 700; }
  .due { color: #b42318; font-weight: 700; }
  .hist { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 9.5px; }
  .hist td { border-top: 1px solid #e4e7eb; padding: 2px 3px; }
  .hist .n { text-align: right; }
  .terms { margin-top: 12px; page-break-inside: avoid; }
  .terms h4 { margin: 0 0 3px; font-size: 9px; letter-spacing: .6px; text-transform: uppercase; color: #1f3a5f; }
  .terms div { white-space: pre-wrap; font-size: 10px; color: #4a5563; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 26px; page-break-inside: avoid; }
  .sign div { padding-top: 34px; border-top: 0; }
  .sign .line { border-top: 1px solid #1f2933; padding-top: 3px; font-size: 10px; }
  .sign .right { text-align: right; }
  .foot { margin-top: 14px; padding-top: 6px; border-top: 1px solid #cbd2d9; display: flex; justify-content: space-between; font-size: 9px; color: #6b7280; }
  .wm { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font-size: 110px; font-weight: 800;
        color: rgba(180, 35, 24, 0.08); transform: rotate(-28deg); pointer-events: none; z-index: 0; }
  @media print { body { padding: 0; } .foot { display: none; } }`;

/** A4 document for printing and the in-app preview (same layout as the PDF). */
export function tradeDocumentHtml(v: TradeDocView): string {
  const f = v.firm;
  const c = v.customer;
  const t = v.totals;
  const logo = safeImg(f.logoUrl);
  const anyDisc = v.items.some(i => Number(i.discountPct) > 0);
  const contact = [f.phone ? `Ph: ${escapeHtml(f.phone)}` : '', f.email ? escapeHtml(f.email) : '',
    f.website ? escapeHtml(f.website.replace(/^https?:\/\//i, '')) : ''].filter(Boolean).join(' &nbsp;|&nbsp; ');

  const party = (title: string, lines: string[], gst?: string | null, phone?: string | null, withGst = true) => `
    <div class="party"><h4>${title}</h4>
      <div class="name">${escapeHtml(c.customerName)}</div>
      ${c.businessName ? `<div>${escapeHtml(c.businessName)}</div>` : ''}
      ${lines.map(l => `<div>${escapeHtml(l)}</div>`).join('')}
      ${withGst ? `<div>GSTIN: <strong>${escapeHtml(gst || 'Unregistered')}</strong></div>` : ''}
      ${phone ? `<div>Phone: ${escapeHtml(phone)}</div>` : ''}
    </div>`;

  const rows = v.items.map(i => `<tr>
      <td class="c">${i.lineNo}</td>
      <td><strong>${escapeHtml(i.itemName)}</strong>${i.productCode ? ` <span class="desc">(${escapeHtml(i.productCode)})</span>` : ''}
        ${i.description ? `<div class="desc">${escapeHtml(i.description)}</div>` : ''}</td>
      <td class="c">${escapeHtml(i.hsnCode || '')}</td>
      <td class="n">${qty(i.quantity)} ${escapeHtml(i.unit)}</td>
      <td class="n">${money(i.rate)}</td>
      ${anyDisc ? `<td class="n">${Number(i.discountPct) > 0 ? pct(i.discountPct) : ''}</td>` : ''}
      <td class="n">${money(i.taxableAmount)}</td>
      <td class="n">${pct(i.gstPct)}</td>
      <td class="n">${money(i.gstAmount)}</td>
      <td class="n"><strong>${money(i.totalAmount)}</strong></td>
    </tr>`).join('');
  const sumQty = v.items.reduce((s, i) => s + Number(i.quantity), 0);
  const sumTaxable = v.items.reduce((s, i) => s + Number(i.taxableAmount), 0);
  const sumGst = v.items.reduce((s, i) => s + Number(i.gstAmount), 0);
  const sumTotal = v.items.reduce((s, i) => s + Number(i.totalAmount), 0);
  const sameUnit = new Set(v.items.map(i => i.unit)).size === 1;

  const hsn = hsnSummary(v);
  const hsnTable = `<table class="hsn"><thead><tr><th>HSN/SAC</th><th class="n">Taxable</th>${v.interstate
      ? '<th class="n">IGST</th>' : '<th class="n">CGST</th><th class="n">SGST</th>'}<th class="n">Total Tax</th></tr></thead><tbody>${
    hsn.map(h => `<tr><td>${escapeHtml(h.hsn)} @ ${pct(h.gstPct)}</td><td class="n">${money(h.taxable)}</td>${v.interstate
      ? `<td class="n">${money(h.igst)}</td>` : `<td class="n">${money(h.cgst)}</td><td class="n">${money(h.sgst)}</td>`}<td class="n">${money(h.totalTax)}</td></tr>`).join('')
  }</tbody></table>`;

  const totalsRows = [
    Number(t.discountAmount) > 0 ? `<tr><td>Gross amount</td><td>${money(t.grossAmount)}</td></tr><tr><td>Discount</td><td>− ${money(t.discountAmount)}</td></tr>` : '',
    `<tr><td>Taxable value</td><td>${money(t.subtotal)}</td></tr>`,
    Number(t.otherChargesAmount) > 0 ? `<tr><td>${escapeHtml(t.otherChargesLabel || 'Other charges')} (GST ${pct(t.otherChargesGstPct)})</td><td>${money(t.otherChargesAmount)}</td></tr>` : '',
    v.interstate ? `<tr><td>IGST</td><td>${money(t.igstAmount)}</td></tr>`
                 : `<tr><td>CGST</td><td>${money(t.cgstAmount)}</td></tr><tr><td>SGST</td><td>${money(t.sgstAmount)}</td></tr>`,
    Number(t.roundOff) !== 0 ? `<tr><td>Round off</td><td>${money(t.roundOff)}</td></tr>` : '',
    `<tr class="grand"><td>${v.creditAmount !== null && v.creditAmount !== undefined ? 'Total Credit' : 'Grand Total'}</td><td>₹ ${money(t.grandTotal)}</td></tr>`
  ].join('');

  const bank = v.showBankUpi && f.bank ? `<div class="box"><h4>Bank Details</h4><table>
      <tr><td>Bank</td><td>${escapeHtml(f.bank.bankName)}</td></tr>
      <tr><td>A/c Name</td><td>${escapeHtml(f.bank.accountName)}</td></tr>
      <tr><td>A/c No.</td><td><strong>${escapeHtml(f.bank.accountNumber)}</strong></td></tr>
      <tr><td>IFSC</td><td><strong>${escapeHtml(f.bank.ifsc)}</strong></td></tr>
      ${f.bank.branch ? `<tr><td>Branch</td><td>${escapeHtml(f.bank.branch)}</td></tr>` : ''}</table></div>` : '';
  const qr = safeImg(f.upi?.qrImageUrl);
  const upi = v.showBankUpi && f.upi ? `<div class="box"><h4>Pay by UPI</h4>${qr ? `<img class="qr" src="${qr}" alt="UPI QR code">` : ''}
      <div>UPI ID</div><div><strong>${escapeHtml(f.upi.upiId)}</strong></div>
      ${v.amountDue > 0 ? `<div style="margin-top:4px">Amount: <strong>₹ ${money(v.amountDue)}</strong></div>` : ''}
      <div class="desc" style="margin-top:4px">Scan with any UPI app</div></div>` : '';
  const p = v.payment;
  const payStatus = p ? `<div class="box"><h4>Payment</h4><table>
      <tr><td>Status</td><td class="${p.balance > 0 ? 'due' : 'paid'}">${escapeHtml(p.statusLabel)}</td></tr>
      ${p.method ? `<tr><td>Method</td><td>${escapeHtml(p.method)}</td></tr>` : ''}
      <tr><td>Paid</td><td>₹ ${money(p.paid)}</td></tr>
      <tr><td>Balance</td><td class="${p.balance > 0 ? 'due' : ''}">₹ ${money(p.balance)}${p.dueDate && p.balance > 0 ? ` (due ${escapeHtml(fmtDate(p.dueDate))})` : ''}</td></tr></table>
      ${p.history.length ? `<table class="hist">${p.history.map(h => `<tr><td>${escapeHtml(fmtDate(h.date))}</td><td>${escapeHtml(h.method)}${h.reference ? ' · ' + escapeHtml(h.reference) : ''}</td><td class="n">${money(h.amount)}</td></tr>`).join('')}</table>` : ''}
    </div>` : v.creditAmount !== null && v.creditAmount !== undefined
      ? `<div class="box"><h4>Credit</h4><div>Amount credited to the customer</div><div class="paid" style="font-size:14px">₹ ${money(v.creditAmount)}</div></div>` : '';
  const paySection = [bank, upi, payStatus].filter(Boolean);

  const footerText = `${v.title} ${v.number} · computer-generated document`;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escapeHtml(v.title)} ${escapeHtml(v.number)}</title>
<style>${a4Styles(footerText)}</style></head>
<body><div class="doc">
  ${v.watermark ? `<div class="wm">${escapeHtml(v.watermark)}</div>` : ''}
  <div class="hdr">
    ${logo ? `<img class="logo" src="${logo}" alt="">` : ''}
    <div class="firm">
      <div class="firm-name">${escapeHtml(f.firmName)}</div>
      ${f.addressLines.map(l => `<div class="line">${escapeHtml(l)}</div>`).join('')}
      ${contact ? `<div class="line">${contact}</div>` : ''}
      <div class="gst">${f.gstNumber ? `GSTIN: ${escapeHtml(f.gstNumber)} &nbsp;|&nbsp; ` : ''}State: ${escapeHtml(f.stateName)} (${escapeHtml(f.stateCode)})</div>
    </div>
    <div class="titlebox"><div class="title">${escapeHtml(v.title)}</div>${v.kind !== 'QUOTATION' ? '<div class="orig">Original for recipient</div>' : ''}</div>
  </div>
  <div class="meta">
    <div><span>${escapeHtml(v.numberLabel)}</span><strong>${escapeHtml(v.number)}</strong></div>
    <div><span>Date</span><strong>${escapeHtml(fmtDate(v.date))}</strong></div>
    ${v.meta.map(m => `<div><span>${escapeHtml(m.label)}</span><strong>${escapeHtml(m.value)}</strong></div>`).join('')}
    ${v.meta.length % 2 === 1 ? '<div></div>' : ''}
  </div>
  <div class="parties">
    ${party('Bill To', addressLines(c.billingAddress, c.billingCity, c.billingStateName, c.billingPinCode), c.gstNumber, c.phone)}
    ${party('Ship To', addressLines(c.shippingAddress, c.shippingCity, c.shippingStateName, c.shippingPinCode), c.gstNumber, null, false)}
  </div>
  <table class="items">
    <thead><tr><th class="c" style="width:22px">#</th><th>Item &amp; Description</th><th class="c">HSN</th><th class="n">Qty</th><th class="n">Rate</th>
      ${anyDisc ? '<th class="n">Disc</th>' : ''}<th class="n">Taxable</th><th class="n">GST</th><th class="n">GST Amt</th><th class="n">Amount (₹)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td></td><td>Total</td><td></td><td class="n">${sameUnit && v.items.length ? qty(sumQty) + ' ' + escapeHtml(v.items[0].unit) : ''}</td><td></td>
      ${anyDisc ? '<td></td>' : ''}<td class="n">${money(sumTaxable)}</td><td></td><td class="n">${money(sumGst)}</td><td class="n">${money(sumTotal)}</td></tr></tfoot>
  </table>
  <div class="lower">
    <div>
      <div class="words"><b>Amount in words:</b> ${escapeHtml(amountInWords(Number(t.grandTotal)))}</div>
      ${hsnTable}
      ${v.reason ? `<div class="note"><strong>Reason:</strong> ${escapeHtml(v.reason)}</div>` : ''}
      ${v.notes ? `<div class="note"><strong>Notes:</strong> ${escapeHtml(v.notes)}</div>` : ''}
    </div>
    <table class="totals">${totalsRows}</table>
  </div>
  ${paySection.length ? `<div class="pay" style="grid-template-columns:repeat(${paySection.length},1fr)">${paySection.join('')}</div>` : ''}
  ${v.terms ? `<div class="terms"><h4>Terms &amp; Conditions</h4><div>${escapeHtml(v.terms)}</div></div>` : ''}
  <div class="sign">
    <div><div class="line">${escapeHtml(v.receiverLabel)}</div></div>
    <div class="right"><div style="margin-bottom:28px">For <strong>${escapeHtml(f.firmName)}</strong></div><div class="line">Authorised Signatory</div></div>
  </div>
  <div class="foot"><span>${escapeHtml(footerText)}</span><span>${escapeHtml(f.firmName)}</span></div>
</div></body></html>`;
}

// ── 80 mm compact / thermal ────────────────────────────────

/** Compact 80 mm layout for thermal printers (browser print, like the retail receipt; retail template untouched). */
export function compactDocumentHtml(v: TradeDocView): string {
  const f = v.firm;
  const c = v.customer;
  const t = v.totals;
  const qr = v.showBankUpi ? safeImg(f.upi?.qrImageUrl) : null;
  const items = v.items.map(i => `
    <div class="it">
      <div class="nm">${i.lineNo}. ${escapeHtml(i.itemName)}</div>
      <div class="rw"><span>${qty(i.quantity)} ${escapeHtml(i.unit)} × ${money(i.rate)}${Number(i.discountPct) > 0 ? ` −${pct(i.discountPct)}` : ''}</span><span>${money(i.totalAmount)}</span></div>
      <div class="sm">HSN ${escapeHtml(i.hsnCode || '—')} · GST ${pct(i.gstPct)} · Taxable ${money(i.taxableAmount)}</div>
    </div>`).join('');
  const p = v.payment;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escapeHtml(v.number)}</title><style>
  @page { size: 80mm auto; margin: 3mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 72mm; color: #000; line-height: 1.4; }
  .c { text-align: center; }
  .firm { font-size: 15px; font-weight: bold; text-align: center; }
  .sm { font-size: 9px; }
  .title { font-weight: bold; text-align: center; margin: 2mm 0 1mm; letter-spacing: 1px; }
  hr { border: none; border-top: 1px dashed #000; margin: 1.5mm 0; }
  .rw { display: flex; justify-content: space-between; gap: 4px; }
  .it { margin-bottom: 1.2mm; }
  .nm { font-weight: bold; }
  .grand { font-size: 13px; font-weight: bold; }
  .qr { display: block; width: 32mm; height: 32mm; margin: 1mm auto; object-fit: contain; }
  .wm { text-align: center; font-weight: bold; border: 1px solid #000; margin: 1mm 0; }
</style></head><body>
  ${f.logoUrl && safeImg(f.logoUrl) ? `<div class="c"><img src="${safeImg(f.logoUrl)}" style="max-height:14mm;max-width:50mm" alt=""></div>` : ''}
  <div class="firm">${escapeHtml(f.firmName)}</div>
  ${f.addressLines.map(l => `<div class="c sm">${escapeHtml(l)}</div>`).join('')}
  ${f.phone ? `<div class="c sm">Ph: ${escapeHtml(f.phone)}</div>` : ''}
  ${f.gstNumber ? `<div class="c sm">GSTIN: ${escapeHtml(f.gstNumber)}</div>` : ''}
  <div class="title">${escapeHtml(v.title)}</div>
  ${v.watermark ? `<div class="wm">${escapeHtml(v.watermark)}</div>` : ''}
  <div class="rw"><span>${escapeHtml(v.numberLabel)}</span><span>${escapeHtml(v.number)}</span></div>
  <div class="rw"><span>Date</span><span>${escapeHtml(fmtDate(v.date))}</span></div>
  ${v.meta.map(m => `<div class="rw sm"><span>${escapeHtml(m.label)}</span><span>${escapeHtml(m.value)}</span></div>`).join('')}
  <hr>
  <div><strong>${escapeHtml(c.customerName)}</strong>${c.businessName ? ` · ${escapeHtml(c.businessName)}` : ''}</div>
  ${addressLines(c.billingAddress, c.billingCity, c.billingStateName, c.billingPinCode).map(l => `<div class="sm">${escapeHtml(l)}</div>`).join('')}
  <div class="sm">GSTIN: ${escapeHtml(c.gstNumber || 'Unregistered')}${c.phone ? ` · ${escapeHtml(c.phone)}` : ''}</div>
  ${c.shippingAddress && c.shippingAddress !== c.billingAddress ? `<div class="sm">Ship to: ${escapeHtml(addressLines(c.shippingAddress, c.shippingCity, c.shippingStateName, c.shippingPinCode).join(', '))}</div>` : ''}
  <hr>${items}<hr>
  <div class="rw"><span>Taxable</span><span>${money(t.subtotal)}</span></div>
  ${Number(t.otherChargesAmount) > 0 ? `<div class="rw"><span>${escapeHtml(t.otherChargesLabel || 'Other charges')}</span><span>${money(t.otherChargesAmount)}</span></div>` : ''}
  ${v.interstate ? `<div class="rw"><span>IGST</span><span>${money(t.igstAmount)}</span></div>`
                 : `<div class="rw"><span>CGST</span><span>${money(t.cgstAmount)}</span></div><div class="rw"><span>SGST</span><span>${money(t.sgstAmount)}</span></div>`}
  ${Number(t.roundOff) !== 0 ? `<div class="rw"><span>Round off</span><span>${money(t.roundOff)}</span></div>` : ''}
  <div class="rw grand"><span>${v.creditAmount !== null && v.creditAmount !== undefined ? 'CREDIT' : 'TOTAL'}</span><span>Rs ${money(t.grandTotal)}</span></div>
  ${p ? `<hr><div class="rw"><span>Status</span><span>${escapeHtml(p.statusLabel)}</span></div>
    ${p.method ? `<div class="rw"><span>Method</span><span>${escapeHtml(p.method)}</span></div>` : ''}
    <div class="rw"><span>Paid</span><span>${money(p.paid)}</span></div>
    <div class="rw"><span>Balance</span><span>${money(p.balance)}</span></div>
    ${p.dueDate && p.balance > 0 ? `<div class="rw sm"><span>Due</span><span>${escapeHtml(fmtDate(p.dueDate))}</span></div>` : ''}` : ''}
  ${v.reason ? `<hr><div class="sm">Reason: ${escapeHtml(v.reason)}</div>` : ''}
  ${v.showBankUpi && f.upi ? `<hr><div class="c sm">Pay by UPI: <strong>${escapeHtml(f.upi.upiId)}</strong></div>${qr ? `<img class="qr" src="${qr}" alt="UPI QR">` : ''}` : ''}
  ${v.terms ? `<hr><div class="sm">${escapeHtml(v.terms)}</div>` : ''}
  <hr><div class="c sm">For ${escapeHtml(f.firmName)}</div><div class="c sm" style="margin-top:6mm">Authorised Signatory</div>
  <hr><div class="c sm">Thank you for your business</div>
</body></html>`;
}

// ── Print / PDF / share ────────────────────────────────────

export function documentFileName(kind: string, number: string): string {
  return `${kind}-${number.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`;
}

export function viewFileName(v: TradeDocView): string {
  const kind = v.kind === 'QUOTATION' ? 'Quotation' : v.kind === 'SALES_RECEIPT' ? 'Receipt'
    : v.kind === 'CREDIT_NOTE' ? 'CreditNote' : 'DebitNote';
  return documentFileName(kind, v.number);
}

/** Opens the HTML in a print window once its images have loaded. compact = 80 mm thermal window. */
export function printHtml(html: string, compact = false): void {
  const w = window.open('', '_blank', compact ? 'width=380,height=700' : 'width=900,height=1000');
  if (!w) { alert('Please allow pop-ups to print.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  const imgs = Array.from(w.document.images);
  Promise.race([
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = () => r(null); }))),
    new Promise(r => setTimeout(r, 4000))
  ]).then(() => setTimeout(() => w.print(), 150));
}

export function printView(v: TradeDocView, compact = false): void {
  printHtml(compact ? compactDocumentHtml(v) : tradeDocumentHtml(v), compact);
}

export async function downloadViewPdf(v: TradeDocView): Promise<void> {
  const { tradePdfBlob } = await import('./wholesale-document-pdf');
  const blob = await tradePdfBlob(v);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = viewFileName(v);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function shareText(v: TradeDocView): string {
  const total = `₹${money(v.totals.grandTotal)} (incl. GST)`;
  const head = `${v.title} ${v.number} from ${v.firm.firmName}`;
  if (v.kind === 'QUOTATION') {
    const valid = v.meta.find(m => m.label === 'Valid Until');
    return `${head}\nAmount: ${total}${valid ? `\nValid until: ${valid.value}` : ''}${v.firm.upi ? `\nPay by UPI: ${v.firm.upi.upiId}` : ''}`;
  }
  if (v.creditAmount !== null && v.creditAmount !== undefined) return `${head}\nAmount credited: ${total}`;
  const p = v.payment;
  return `${head}\nTotal: ${total}\n` + (p && p.balance > 0
    ? `Paid: ₹${money(p.paid)} · Balance due: ₹${money(p.balance)}${p.dueDate ? ` by ${fmtDate(p.dueDate)}` : ''}${v.firm.upi ? `\nPay by UPI: ${v.firm.upi.upiId}` : ''}`
    : 'Paid in full. Thank you!');
}

export type ShareResult = 'shared' | 'whatsapp' | 'copied' | 'cancelled';

/**
 * Share: device share sheet with the PDF attached where supported; otherwise downloads the PDF and opens WhatsApp
 * to the customer's number with a summary (or copies the summary).
 */
export async function shareView(v: TradeDocView): Promise<ShareResult> {
  const { tradePdfBlob } = await import('./wholesale-document-pdf');
  const text = shareText(v);
  const file = new File([await tradePdfBlob(v)], viewFileName(v), { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `${v.title} ${v.number}`, text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  await downloadViewPdf(v);
  const digits = (v.customer.phone || '').replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    const phone = digits.length === 10 ? '91' + digits : digits;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text + '\n(PDF attached separately)')}`, '_blank');
    return 'whatsapp';
  }
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  return 'copied';
}

// Backward-compatible helpers used by the quotation / sales screens.
export const quotationHtml = (q: WholesaleQuotation) => tradeDocumentHtml(quotationView(q));
export const salesDocumentHtml = (d: WholesaleSalesDocument) => tradeDocumentHtml(salesDocumentView(d));
