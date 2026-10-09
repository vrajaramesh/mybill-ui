# Wholesale document templates (Quotation, Sales Receipt, Credit Note, Debit Note)

Retail bill / receipt templates (`billing.component.ts`, `ThermalPrinterService`) are separate and unchanged.

## One data model, three outputs

`src/app/wholesale/wholesale-trade-documents.ts` turns a saved document into a `TradeDocView`
(`quotationView(q)` / `salesDocumentView(d)`) using only the document's own snapshots (firm, customer, rates, GST,
totals, frozen print title and semantics). That view feeds:

| Output | Function | Notes |
|---|---|---|
| A4 print + in-app preview | `tradeDocumentHtml(view)` / `printView(view)` | Table header repeats on every printed page; page numbers + footer via `@page` margin boxes (Chrome/Edge 131+); `₹` symbol |
| A4 PDF (download / share) | `downloadViewPdf(view)`, `shareView(view)` → `wholesale-document-pdf.ts` | Native **jsPDF** drawing (the PDF library the app already had) — real text, ~10–20 KB, proper page breaks, repeated table header + continuation header, footer with "Page x of y", watermark. Built-in PDF fonts have no `₹`, so the PDF shows `Rs.` |
| 80 mm thermal / compact | `compactDocumentHtml(view)` / `printView(view, true)` | Browser print at 80 mm (like the retail receipt) |

The PDF module is lazy-loaded (only when a PDF is created). `html2canvas` is no longer used.

## Layout (all outputs)

1. Letterhead: logo, firm name, address, phone / email / website, GSTIN + state; title box (configured printed title,
   "Original for recipient" on sales documents)
2. Details grid: document number, date, valid-until / due date, reference ("Against Invoice … dt. …" / quotation),
   place of supply, reverse charge
3. Bill To (with GSTIN, phone) / Ship To
4. GST table: #, item + code + description, HSN, qty + unit, rate, discount (only if any), taxable, GST %, GST amount,
   amount; totals row
5. Amount in words, HSN-wise tax summary (CGST/SGST or IGST), reason, notes | totals box (gross, discount, taxable,
   other charges, CGST/SGST or IGST, round off, grand total / total credit)
6. Bank details · UPI (ID, QR image, amount due) · payment status (paid, balance, due date, payment history) — bank/UPI only
   while something is payable
7. Terms & conditions + signatures (receiver / "For <firm>, Authorised Signatory"), kept together on one page
8. Footer on every page: title, number, "computer-generated document", Page x of y; DRAFT / CANCELLED watermark

## Not covered

- The UPI QR is the image uploaded in Settings → UPI Details (no QR is generated from the UPI ID).
- Logo/QR appear in the PDF only if the image host allows cross-origin requests (Cloudinary does); otherwise the PDF
  omits them while printing still shows them.
- Thermal output uses the browser print dialog; the Bluetooth printer integration remains retail-only.
