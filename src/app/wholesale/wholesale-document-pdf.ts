import { jsPDF } from 'jspdf';
import {
  TradeDocView, addressLines, amountInWords, fmtDate, hsnSummary, money, pct, qty
} from './wholesale-trade-documents';

/**
 * Native A4 PDF for wholesale documents, drawn with jsPDF (the PDF library the app already uses — no new library).
 * Real text (selectable, small files), proper pagination: the items table header repeats on every page, a compact
 * header continues the document on later pages, and every page gets a footer with "Page x of y".
 * Same content and order as tradeDocumentHtml(). Loaded lazily only when a PDF is created.
 *
 * Built-in PDF fonts have no ₹ glyph, so amounts use "Rs." here (the HTML print uses ₹).
 */

type RGB = [number, number, number];
const NAVY: RGB = [31, 58, 95];
const TEXT: RGB = [31, 41, 51];
const MUTED: RGB = [107, 114, 128];
const BORDER: RGB = [203, 210, 217];
const ZEBRA: RGB = [247, 249, 251];
const SOFT: RGB = [238, 242, 247];
const RED: RGB = [180, 35, 24];
const GREEN: RGB = [15, 107, 58];

const PAGE_W = 210;
const PAGE_H = 297;
const M_LEFT = 12;
const M_RIGHT = 12;
const M_TOP = 12;
const FOOTER_H = 14;
const CW = PAGE_W - M_LEFT - M_RIGHT;
const BOTTOM = PAGE_H - FOOTER_H;
const LINE = 3.6;

interface LoadedImage { data: string; w: number; h: number; }

/** Fetches an https image and converts it to PNG (handles WEBP); null if unavailable (e.g. CORS). */
async function loadImage(url?: string | null): Promise<LoadedImage | null> {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    return { data: canvas.toDataURL('image/png'), w: bitmap.width, h: bitmap.height };
  } catch {
    return null;
  }
}

function fit(img: LoadedImage, maxW: number, maxH: number): { w: number; h: number } {
  const ratio = Math.min(maxW / img.w, maxH / img.h);
  return { w: img.w * ratio, h: img.h * ratio };
}

const rs = (n: number | null | undefined) => 'Rs. ' + money(n);

export async function tradePdfBlob(v: TradeDocView): Promise<Blob> {
  const [logo, qr] = await Promise.all([loadImage(v.firm.logoUrl), v.showBankUpi ? loadImage(v.firm.upi?.qrImageUrl) : Promise.resolve(null)]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: `${v.title} ${v.number}`, subject: v.title, author: v.firm.firmName, creator: 'MyBill Wholesale' });
  const f = v.firm;
  const c = v.customer;
  const t = v.totals;
  let y = M_TOP;

  // ── helpers ──────────────────────────────────────────────
  const color = (rgb: RGB) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const font = (size: number, style: 'normal' | 'bold' = 'normal', rgb: RGB = TEXT) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    color(rgb);
  };
  const wrap = (text: string, width: number, size: number, style: 'normal' | 'bold' = 'normal'): string[] => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    return doc.splitTextToSize(text || '', width) as string[];
  };
  const box = (x: number, top: number, w: number, h: number, fill?: RGB) => {
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.2);
    if (fill) { doc.setFillColor(fill[0], fill[1], fill[2]); doc.rect(x, top, w, h, 'FD'); }
    else doc.rect(x, top, w, h);
  };
  const sectionTitle = (text: string, x: number, top: number) => { font(7, 'bold', NAVY); doc.text(text.toUpperCase(), x, top); };

  const continuationHeader = () => {
    font(10, 'bold', NAVY);
    doc.text(f.firmName, M_LEFT, y + 4);
    font(9, 'bold', NAVY);
    doc.text(`${v.title}  ${v.number}`, PAGE_W - M_RIGHT, y + 4, { align: 'right' });
    doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.setLineWidth(0.5);
    doc.line(M_LEFT, y + 6.5, PAGE_W - M_RIGHT, y + 6.5);
    y += 10;
  };
  const newPage = (afterHeader?: () => void) => {
    doc.addPage();
    y = M_TOP;
    continuationHeader();
    afterHeader?.();
  };
  const ensure = (h: number, afterHeader?: () => void) => { if (y + h > BOTTOM) newPage(afterHeader); };

  // ── 1. Letterhead ────────────────────────────────────────
  let textX = M_LEFT;
  let logoBottom = y;
  if (logo) {
    const s = fit(logo, 32, 18);
    doc.addImage(logo.data, 'PNG', M_LEFT, y, s.w, s.h);
    textX = M_LEFT + s.w + 4;
    logoBottom = y + s.h;
  }
  const titleW = 62;
  const firmW = PAGE_W - M_RIGHT - titleW - textX;
  let fy = y + 5;
  font(15, 'bold', NAVY);
  for (const l of wrap(f.firmName, firmW, 15, 'bold')) { doc.text(l, textX, fy); fy += 6; }
  font(8.5, 'normal', MUTED);
  for (const line of f.addressLines) for (const l of wrap(line, firmW, 8.5)) { doc.text(l, textX, fy); fy += LINE; }
  const contact = [f.phone ? `Ph: ${f.phone}` : '', f.email || '', f.website ? f.website.replace(/^https?:\/\//i, '') : ''].filter(Boolean).join('  |  ');
  if (contact) for (const l of wrap(contact, firmW, 8.5)) { doc.text(l, textX, fy); fy += LINE; }
  font(8.5, 'bold', TEXT);
  doc.text(`${f.gstNumber ? 'GSTIN: ' + f.gstNumber + '  |  ' : ''}State: ${f.stateName} (${f.stateCode})`, textX, fy);
  fy += LINE;

  font(13, 'bold', NAVY);
  let ty = y + 5;
  for (const l of wrap(v.title, titleW, 13, 'bold')) { doc.text(l, PAGE_W - M_RIGHT, ty, { align: 'right' }); ty += 5.5; }
  if (v.kind !== 'QUOTATION') { font(6.5, 'normal', MUTED); doc.text('ORIGINAL FOR RECIPIENT', PAGE_W - M_RIGHT, ty, { align: 'right' }); ty += 4; }

  y = Math.max(fy, ty, logoBottom) + 1;
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.9);
  doc.line(M_LEFT, y, PAGE_W - M_RIGHT, y);
  y += 3;

  // ── 2. Document details (2-column grid) ──────────────────
  const meta = [{ label: v.numberLabel, value: v.number }, { label: 'Date', value: fmtDate(v.date) }, ...v.meta];
  const cellW = CW / 2;
  const cellH = 6;
  for (let i = 0; i < meta.length; i += 2) {
    for (let j = 0; j < 2; j++) {
      const m = meta[i + j];
      const x = M_LEFT + j * cellW;
      box(x, y, cellW, cellH);
      if (!m) continue;
      font(8, 'normal', MUTED);
      doc.text(m.label, x + 2, y + 4);
      font(8.5, 'bold', TEXT);
      doc.text(wrap(m.value, cellW - 36, 8.5, 'bold')[0] || '', x + 34, y + 4);
    }
    y += cellH;
  }

  // ── 3. Bill to / Ship to ─────────────────────────────────
  const partyLines = (lines: string[], withGst: boolean, phone?: string | null) => {
    const out: { text: string; bold?: boolean }[] = [{ text: c.customerName, bold: true }];
    if (c.businessName) out.push({ text: c.businessName });
    lines.forEach(l => out.push({ text: l }));
    if (withGst) out.push({ text: `GSTIN: ${c.gstNumber || 'Unregistered'}`, bold: true });
    if (phone) out.push({ text: `Phone: ${phone}` });
    return out.flatMap(o => wrap(o.text, cellW - 4, 8.5, o.bold ? 'bold' : 'normal').map(t => ({ text: t, bold: o.bold })));
  };
  const bill = partyLines(addressLines(c.billingAddress, c.billingCity, c.billingStateName, c.billingPinCode), true, c.phone);
  const ship = partyLines(addressLines(c.shippingAddress, c.shippingCity, c.shippingStateName, c.shippingPinCode), false, null);
  const partyH = Math.max(bill.length, ship.length) * LINE + 8;
  ensure(partyH);
  [[bill, 'Bill To'], [ship, 'Ship To']].forEach(([lines, title], j) => {
    const x = M_LEFT + j * cellW;
    box(x, y, cellW, partyH);
    sectionTitle(title as string, x + 2, y + 4);
    let ly = y + 8;
    for (const l of lines as { text: string; bold?: boolean }[]) {
      font(8.5, l.bold ? 'bold' : 'normal', TEXT);
      doc.text(l.text, x + 2, ly);
      ly += LINE;
    }
  });
  y += partyH + 3;

  // ── 4. Items table ───────────────────────────────────────
  const anyDisc = v.items.some(i => Number(i.discountPct) > 0);
  type Col = { title: string; w: number; align: 'left' | 'right' | 'center' };
  const cols: Col[] = [
    { title: '#', w: 7, align: 'center' },
    { title: 'Item & Description', w: 0, align: 'left' },
    { title: 'HSN', w: 15, align: 'center' },
    { title: 'Qty', w: 20, align: 'right' },
    { title: 'Rate', w: 17, align: 'right' },
    ...(anyDisc ? [{ title: 'Disc', w: 11, align: 'right' as const }] : []),
    { title: 'Taxable', w: 21, align: 'right' },
    { title: 'GST', w: 11, align: 'right' },
    { title: 'GST Amt', w: 18, align: 'right' },
    { title: 'Amount', w: 21, align: 'right' }
  ];
  cols[1].w = CW - cols.reduce((s, col) => s + col.w, 0);
  const colX: number[] = [];
  cols.reduce((x, col) => { colX.push(x); return x + col.w; }, M_LEFT);
  const cellText = (text: string, i: number, top: number) => {
    const col = cols[i];
    const x = col.align === 'right' ? colX[i] + col.w - 1.5 : col.align === 'center' ? colX[i] + col.w / 2 : colX[i] + 1.5;
    doc.text(text, x, top, { align: col.align });
  };
  const tableHeader = () => {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(M_LEFT, y, CW, 7, 'F');
    font(7.5, 'bold', [255, 255, 255]);
    cols.forEach((col, i) => cellText(col.title, i, y + 4.6));
    y += 7;
  };
  ensure(7 + 10);
  tableHeader();
  v.items.forEach((it, idx) => {
    const nameLines = wrap(it.itemName + (it.productCode ? ` (${it.productCode})` : ''), cols[1].w - 3, 8, 'bold');
    const descLines = it.description ? wrap(it.description, cols[1].w - 3, 7) : [];
    const h = (nameLines.length + descLines.length) * 3.4 + 3;
    ensure(h, tableHeader);
    if (idx % 2 === 1) { doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]); doc.rect(M_LEFT, y, CW, h, 'F'); }
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.15);
    cols.forEach((col, i) => doc.rect(colX[i], y, col.w, h));
    const top = y + 3.8;
    font(8, 'normal', TEXT);
    cellText(String(it.lineNo), 0, top);
    let ny = top;
    font(8, 'bold', TEXT);
    nameLines.forEach(l => { doc.text(l, colX[1] + 1.5, ny); ny += 3.4; });
    font(7, 'normal', MUTED);
    descLines.forEach(l => { doc.text(l, colX[1] + 1.5, ny); ny += 3.4; });
    font(8, 'normal', TEXT);
    let i = 2;
    cellText(it.hsnCode || '', i++, top);
    cellText(`${qty(it.quantity)} ${it.unit}`, i++, top);
    cellText(money(it.rate), i++, top);
    if (anyDisc) cellText(Number(it.discountPct) > 0 ? pct(it.discountPct) : '', i++, top);
    cellText(money(it.taxableAmount), i++, top);
    cellText(pct(it.gstPct), i++, top);
    cellText(money(it.gstAmount), i++, top);
    font(8, 'bold', TEXT);
    cellText(money(it.totalAmount), i, top);
    y += h;
  });
  // totals row
  ensure(7, tableHeader);
  box(M_LEFT, y, CW, 7, SOFT);
  font(8, 'bold', TEXT);
  const units = new Set(v.items.map(i => i.unit));
  const sum = (k: 'quantity' | 'taxableAmount' | 'gstAmount' | 'totalAmount') => v.items.reduce((s, i) => s + Number(i[k]), 0);
  cellText('Total', 1, y + 4.6);
  if (units.size === 1 && v.items.length) cellText(`${qty(sum('quantity'))} ${v.items[0].unit}`, 3, y + 4.6);
  const off = anyDisc ? 1 : 0;
  cellText(money(sum('taxableAmount')), 5 + off, y + 4.6);
  cellText(money(sum('gstAmount')), 7 + off, y + 4.6);
  cellText(money(sum('totalAmount')), 8 + off, y + 4.6);
  y += 10;

  // ── 5. Amount in words + HSN summary (left), totals (right) ──
  const leftW = 110;
  const rightW = CW - leftW - 4;
  const rightX = M_LEFT + leftW + 4;
  const wordsLines = wrap(`Amount in words: ${amountInWords(Number(t.grandTotal))}`, leftW - 4, 8.5);
  const hsn = hsnSummary(v);
  const extraLines = [
    ...(v.reason ? wrap(`Reason: ${v.reason}`, leftW - 4, 8) : []),
    ...(v.notes ? wrap(`Notes: ${v.notes}`, leftW - 4, 8) : [])
  ];
  const totals: { label: string; value: string }[] = [];
  if (Number(t.discountAmount) > 0) {
    totals.push({ label: 'Gross amount', value: money(t.grossAmount) }, { label: 'Discount', value: '- ' + money(t.discountAmount) });
  }
  totals.push({ label: 'Taxable value', value: money(t.subtotal) });
  if (Number(t.otherChargesAmount) > 0) totals.push({ label: `${t.otherChargesLabel || 'Other charges'} (GST ${pct(t.otherChargesGstPct)})`, value: money(t.otherChargesAmount) });
  if (v.interstate) totals.push({ label: 'IGST', value: money(t.igstAmount) });
  else totals.push({ label: 'CGST', value: money(t.cgstAmount) }, { label: 'SGST', value: money(t.sgstAmount) });
  if (Number(t.roundOff) !== 0) totals.push({ label: 'Round off', value: money(t.roundOff) });
  const leftH = wordsLines.length * LINE + 4 + 6 + (hsn.length + 1) * 5 + (extraLines.length ? extraLines.length * LINE + 4 : 0);
  const rightH = totals.length * 6 + 9;
  ensure(Math.max(leftH, rightH));
  const blockTop = y;

  box(M_LEFT, y, leftW, wordsLines.length * LINE + 4);
  font(8.5, 'normal', TEXT);
  wordsLines.forEach((l, i) => doc.text(l, M_LEFT + 2, y + 4 + i * LINE));
  y += wordsLines.length * LINE + 6;
  const hsnCols = v.interstate
    ? [{ t: 'HSN @ rate', w: 34 }, { t: 'Taxable', w: 26 }, { t: 'IGST', w: 26 }, { t: 'Total Tax', w: 24 }]
    : [{ t: 'HSN @ rate', w: 30 }, { t: 'Taxable', w: 22 }, { t: 'CGST', w: 18 }, { t: 'SGST', w: 18 }, { t: 'Total Tax', w: 22 }];
  const hsnRow = (vals: string[], fill?: RGB, bold = false) => {
    let x = M_LEFT;
    hsnCols.forEach((col, i) => {
      box(x, y, col.w, 5, fill);
      font(7.5, bold ? 'bold' : 'normal', TEXT);
      if (i === 0) doc.text(vals[i], x + 1.5, y + 3.5); else doc.text(vals[i], x + col.w - 1.5, y + 3.5, { align: 'right' });
      x += col.w;
    });
    y += 5;
  };
  hsnRow(hsnCols.map(col => col.t), SOFT, true);
  hsn.forEach(h => hsnRow(v.interstate
    ? [`${h.hsn} @ ${pct(h.gstPct)}`, money(h.taxable), money(h.igst), money(h.totalTax)]
    : [`${h.hsn} @ ${pct(h.gstPct)}`, money(h.taxable), money(h.cgst), money(h.sgst), money(h.totalTax)]));
  if (extraLines.length) {
    y += 2;
    font(8, 'normal', TEXT);
    extraLines.forEach(l => { doc.text(l, M_LEFT + 1, y + 3); y += LINE; });
  }
  const leftBottom = y;

  y = blockTop;
  totals.forEach(r => {
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.line(rightX, y + 6, rightX + rightW, y + 6);
    font(8.5, 'normal', MUTED);
    doc.text(wrap(r.label, rightW - 30, 8.5)[0], rightX + 2, y + 4.2);
    font(8.5, 'normal', TEXT);
    doc.text(r.value, rightX + rightW - 2, y + 4.2, { align: 'right' });
    y += 6;
  });
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(rightX, y + 1, rightW, 8, 'F');
  font(10.5, 'bold', [255, 255, 255]);
  doc.text(v.creditAmount !== null && v.creditAmount !== undefined ? 'Total Credit' : 'Grand Total', rightX + 2, y + 6.4);
  doc.text(rs(t.grandTotal), rightX + rightW - 2, y + 6.4, { align: 'right' });
  y = Math.max(leftBottom, y + 9) + 5;

  // ── 6. Bank / UPI / payment ──────────────────────────────
  type Panel = { title: string; lines: { text: string; bold?: boolean; rgb?: RGB }[]; qr?: LoadedImage | null };
  const panels: Panel[] = [];
  if (v.showBankUpi && f.bank) panels.push({ title: 'Bank Details', lines: [
    { text: `Bank: ${f.bank.bankName}` }, { text: `A/c Name: ${f.bank.accountName}` },
    { text: `A/c No.: ${f.bank.accountNumber}`, bold: true }, { text: `IFSC: ${f.bank.ifsc}`, bold: true },
    ...(f.bank.branch ? [{ text: `Branch: ${f.bank.branch}` }] : [])] });
  if (v.showBankUpi && f.upi) panels.push({ title: 'Pay by UPI', qr, lines: [
    { text: 'UPI ID:' }, { text: f.upi.upiId, bold: true },
    ...(v.amountDue > 0 ? [{ text: `Amount: ${rs(v.amountDue)}`, bold: true }] : []),
    { text: 'Scan with any UPI app', rgb: MUTED }] });
  if (v.payment) {
    const p = v.payment;
    panels.push({ title: 'Payment', lines: [
      { text: `Status: ${p.statusLabel}`, bold: true, rgb: p.balance > 0 ? RED : GREEN },
      ...(p.method ? [{ text: `Method: ${p.method}` }] : []),
      { text: `Paid: ${rs(p.paid)}` },
      { text: `Balance: ${rs(p.balance)}${p.dueDate && p.balance > 0 ? ' (due ' + fmtDate(p.dueDate) + ')' : ''}`, bold: p.balance > 0, rgb: p.balance > 0 ? RED : TEXT },
      ...p.history.slice(-4).map(h => ({ text: `${fmtDate(h.date)} ${h.method}: ${money(h.amount)}`, rgb: MUTED }))] });
  } else if (v.creditAmount !== null && v.creditAmount !== undefined) {
    panels.push({ title: 'Credit', lines: [{ text: 'Amount credited to the customer' }, { text: rs(v.creditAmount), bold: true, rgb: GREEN }] });
  }
  if (panels.length) {
    const pw = (CW - (panels.length - 1) * 3) / panels.length;
    const wrapped = panels.map(pn => pn.lines.flatMap(l => wrap(l.text, pn.qr ? pw - 30 : pw - 4, 8, l.bold ? 'bold' : 'normal')
      .map(text => ({ ...l, text }))));
    const ph = Math.max(...wrapped.map((ls, i) => Math.max(ls.length * LINE + 9, panels[i].qr ? 32 : 0)));
    ensure(ph);
    panels.forEach((pn, i) => {
      const x = M_LEFT + i * (pw + 3);
      box(x, y, pw, ph);
      sectionTitle(pn.title, x + 2, y + 4);
      let ly = y + 8.5;
      wrapped[i].forEach(l => { font(8, l.bold ? 'bold' : 'normal', l.rgb || TEXT); doc.text(l.text, x + 2, ly); ly += LINE; });
      if (pn.qr) {
        const s = fit(pn.qr, 26, 26);
        doc.addImage(pn.qr.data, 'PNG', x + pw - s.w - 2, y + 4, s.w, s.h);
      }
    });
    y += ph + 5;
  }

  // ── 7. Terms (kept together with the signatures when they fit on one page) ──
  const SIGNATURE_H = 24;
  const termLines = v.terms ? v.terms.split('\n').flatMap(l => wrap(l, CW, 7.5)) : [];
  const termsH = termLines.length ? termLines.length * 3.2 + 9 : 0;
  if (y + termsH + SIGNATURE_H > BOTTOM && termsH + SIGNATURE_H < BOTTOM - M_TOP - 20) newPage();
  if (v.terms) {
    ensure(Math.min(termLines.length, 6) * 3.2 + 6);
    sectionTitle('Terms & Conditions', M_LEFT, y + 3);
    y += 6;
    font(7.5, 'normal', MUTED);
    for (const l of termLines) {
      ensure(3.2);
      doc.text(l, M_LEFT, y + 2.5);
      y += 3.2;
    }
    y += 3;
  }

  // ── 8. Signatures ────────────────────────────────────────
  ensure(22);
  y += 2;
  font(8.5, 'bold', TEXT);
  doc.text(`For ${f.firmName}`, PAGE_W - M_RIGHT, y + 2, { align: 'right' });
  doc.setDrawColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.setLineWidth(0.3);
  doc.line(M_LEFT, y + 15, M_LEFT + 60, y + 15);
  doc.line(PAGE_W - M_RIGHT - 60, y + 15, PAGE_W - M_RIGHT, y + 15);
  font(8, 'normal', MUTED);
  doc.text(v.receiverLabel, M_LEFT, y + 19);
  doc.text('Authorised Signatory', PAGE_W - M_RIGHT, y + 19, { align: 'right' });

  // ── 9. Footer + page numbers + watermark on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (v.watermark) {
      const GState = (doc as any).GState;
      if (GState) doc.setGState(new GState({ opacity: 0.08 }));
      font(90, 'bold', GState ? RED : [250, 228, 228]);
      doc.text(v.watermark, PAGE_W / 2, PAGE_H / 2 + 20, { align: 'center', angle: 30 });
      if (GState) doc.setGState(new GState({ opacity: 1 }));
    }
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    doc.line(M_LEFT, PAGE_H - 11, PAGE_W - M_RIGHT, PAGE_H - 11);
    font(7, 'normal', MUTED);
    doc.text(`${v.title} ${v.number}  ·  This is a computer-generated document.`, M_LEFT, PAGE_H - 7);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - M_RIGHT, PAGE_H - 7, { align: 'right' });
  }

  return doc.output('blob');
}
