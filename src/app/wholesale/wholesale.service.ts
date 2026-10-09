import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  WholesaleAssistantChatRequest, WholesaleAssistantResult, WholesaleAssistantSettings, WholesaleIgConversation, WholesaleIgConversationSummary, WholesaleIgFilter, WholesaleIgMessage,
  WholesaleInstagramSettings, WholesaleInstagramSettingsRequest,
  WholesaleCurrentStockRow, WholesaleInventorySettings, WholesaleLedgerEntry, WholesaleProductStockHistory,
  WholesaleStockAdjustment, WholesaleStockAdjustmentRequest, WholesaleStockMovementRow,
  WholesaleConversionRequest, WholesaleSalesDocument, WholesaleSalesDocumentSummary,
  WholesalePaymentRequest, WholesaleSalesReceiptRequest, WholesaleSalesDocumentRequest,
  WholesaleDocumentSettings, WholesaleQuotation, WholesaleQuotationRequest, WholesaleQuotationSummary,
  WholesaleBankDetails, WholesaleBusinessProfile, WholesaleDocumentProfile, WholesaleProfileDetails, WholesaleUpiDetails,
  WholesaleCustomer, WholesaleCustomerMatch, WholesaleCustomerOptions, WholesaleCustomerRequest,
  WholesalePriceQuote, WholesalePriceRule, WholesalePriceRuleRequest,
  WholesaleProduct, WholesaleProductImage, WholesaleProductRequest,
  WholesalePurchase, WholesalePurchaseRequest
} from './wholesale.model';

@Injectable({
  providedIn: 'root'
})
export class WholesaleService {
  private apiUrl = '/api/wholesale';

  constructor(private http: HttpClient) { }

  getProducts(activeOnly = false): Observable<WholesaleProduct[]> {
    return this.http.get<WholesaleProduct[]>(`${this.apiUrl}/products`, { params: { activeOnly } });
  }

  getProduct(id: number): Observable<WholesaleProduct> {
    return this.http.get<WholesaleProduct>(`${this.apiUrl}/products/${id}`);
  }

  /** Only allowed for products never purchased; otherwise the API answers 409 (deactivate instead). */
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/products/${id}`);
  }

  createProduct(product: WholesaleProductRequest): Observable<WholesaleProduct> {
    return this.http.post<WholesaleProduct>(`${this.apiUrl}/products`, product);
  }

  updateProduct(id: number, product: WholesaleProductRequest): Observable<WholesaleProduct> {
    return this.http.put<WholesaleProduct>(`${this.apiUrl}/products/${id}`, product);
  }

  addProductImage(id: number, imageUrl: string, publicId?: string): Observable<WholesaleProductImage> {
    return this.http.post<WholesaleProductImage>(`${this.apiUrl}/products/${id}/images`, { imageUrl, publicId });
  }

  deleteProductImage(id: number, imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/products/${id}/images/${imageId}`);
  }

  /** Reuses the existing generic upload endpoint (returns the stored URL); no retail AI side effects. */
  uploadImage(file: File): Observable<{ secure_url: string; public_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ secure_url: string; public_id: string }>('/api/upload/image', formData);
  }

  getPriceRules(productId: number, includeInactive = true): Observable<WholesalePriceRule[]> {
    return this.http.get<WholesalePriceRule[]>(`${this.apiUrl}/products/${productId}/price-rules`, { params: { includeInactive } });
  }

  createPriceRule(productId: number, rule: WholesalePriceRuleRequest): Observable<WholesalePriceRule> {
    return this.http.post<WholesalePriceRule>(`${this.apiUrl}/products/${productId}/price-rules`, rule);
  }

  updatePriceRule(productId: number, ruleId: number, rule: WholesalePriceRuleRequest): Observable<WholesalePriceRule> {
    return this.http.put<WholesalePriceRule>(`${this.apiUrl}/products/${productId}/price-rules/${ruleId}`, rule);
  }

  deletePriceRule(productId: number, ruleId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/products/${productId}/price-rules/${ruleId}`);
  }

  /** Applicable wholesale price for a quantity (optionally on a date / inter-state). */
  getPrice(productId: number, quantity: number, interstate = false, date?: string): Observable<WholesalePriceQuote> {
    const params: Record<string, string | number | boolean> = { quantity, interstate };
    if (date) params['date'] = date;
    return this.http.get<WholesalePriceQuote>(`${this.apiUrl}/products/${productId}/price`, { params });
  }

  // ── Customers ────────────────────────────────────────────

  /** Search customers (list screen and the document customer picker). */
  searchCustomers(q = '', type = '', activeOnly = false, limit?: number): Observable<WholesaleCustomer[]> {
    const params: Record<string, string | number | boolean> = { q, activeOnly };
    if (type) params['type'] = type;
    if (limit) params['limit'] = limit;
    return this.http.get<WholesaleCustomer[]>(`${this.apiUrl}/customers`, { params });
  }

  getCustomer(id: number): Observable<WholesaleCustomer> {
    return this.http.get<WholesaleCustomer>(`${this.apiUrl}/customers/${id}`);
  }

  createCustomer(customer: WholesaleCustomerRequest): Observable<WholesaleCustomer> {
    return this.http.post<WholesaleCustomer>(`${this.apiUrl}/customers`, customer);
  }

  updateCustomer(id: number, customer: WholesaleCustomerRequest): Observable<WholesaleCustomer> {
    return this.http.put<WholesaleCustomer>(`${this.apiUrl}/customers/${id}`, customer);
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/customers/${id}`);
  }

  getCustomerOptions(): Observable<WholesaleCustomerOptions> {
    return this.http.get<WholesaleCustomerOptions>(`${this.apiUrl}/customers/options`);
  }

  findDuplicateCustomers(gstNumber: string, phone: string, customerName: string, excludeId?: number): Observable<WholesaleCustomerMatch[]> {
    const params: Record<string, string | number> = { gstNumber, phone, customerName };
    if (excludeId) params['excludeId'] = excludeId;
    return this.http.get<WholesaleCustomerMatch[]>(`${this.apiUrl}/customers/duplicate-check`, { params });
  }

  // ── Business profile (Settings) ──────────────────────────

  getBusinessProfile(): Observable<WholesaleBusinessProfile> {
    return this.http.get<WholesaleBusinessProfile>(`${this.apiUrl}/business-profile`);
  }

  /** Print-ready profile for documents; errors with 409 until the mandatory profile fields are saved. */
  getDocumentProfile(): Observable<WholesaleDocumentProfile> {
    return this.http.get<WholesaleDocumentProfile>(`${this.apiUrl}/business-profile/document`);
  }

  saveProfileDetails(details: WholesaleProfileDetails): Observable<WholesaleBusinessProfile> {
    return this.http.put<WholesaleBusinessProfile>(`${this.apiUrl}/business-profile/details`, details);
  }

  saveBankDetails(bank: WholesaleBankDetails): Observable<WholesaleBusinessProfile> {
    return this.http.put<WholesaleBusinessProfile>(`${this.apiUrl}/business-profile/bank`, bank);
  }

  clearBankDetails(): Observable<WholesaleBusinessProfile> {
    return this.http.delete<WholesaleBusinessProfile>(`${this.apiUrl}/business-profile/bank`);
  }

  saveUpiDetails(upi: WholesaleUpiDetails): Observable<WholesaleBusinessProfile> {
    return this.http.put<WholesaleBusinessProfile>(`${this.apiUrl}/business-profile/upi`, upi);
  }

  clearUpiDetails(): Observable<WholesaleBusinessProfile> {
    return this.http.delete<WholesaleBusinessProfile>(`${this.apiUrl}/business-profile/upi`);
  }

  // ── Quotations ───────────────────────────────────────────

  getQuotations(filters: { q?: string; status?: string; from?: string; to?: string } = {}): Observable<WholesaleQuotationSummary[]> {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return this.http.get<WholesaleQuotationSummary[]>(`${this.apiUrl}/quotations`, { params });
  }

  getQuotation(id: number): Observable<WholesaleQuotation> {
    return this.http.get<WholesaleQuotation>(`${this.apiUrl}/quotations/${id}`);
  }

  /** Server-side calculation without saving (live totals). */
  previewQuotation(request: WholesaleQuotationRequest): Observable<WholesaleQuotation> {
    return this.http.post<WholesaleQuotation>(`${this.apiUrl}/quotations/preview`, request);
  }

  createQuotation(request: WholesaleQuotationRequest): Observable<WholesaleQuotation> {
    return this.http.post<WholesaleQuotation>(`${this.apiUrl}/quotations`, request);
  }

  updateQuotation(id: number, request: WholesaleQuotationRequest): Observable<WholesaleQuotation> {
    return this.http.put<WholesaleQuotation>(`${this.apiUrl}/quotations/${id}`, request);
  }

  deleteQuotation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/quotations/${id}`);
  }

  duplicateQuotation(id: number, reprice: boolean): Observable<WholesaleQuotation> {
    return this.http.post<WholesaleQuotation>(`${this.apiUrl}/quotations/${id}/duplicate`, null, { params: { reprice } });
  }

  issueQuotation(id: number): Observable<WholesaleQuotation> {
    return this.http.post<WholesaleQuotation>(`${this.apiUrl}/quotations/${id}/issue`, null);
  }

  changeQuotationStatus(id: number, status: 'ACCEPTED' | 'REJECTED' | 'CANCELLED', reason?: string): Observable<WholesaleQuotation> {
    return this.http.post<WholesaleQuotation>(`${this.apiUrl}/quotations/${id}/status`, { status, reason });
  }

  getDocumentSettings(docType = 'QUOTATION'): Observable<WholesaleDocumentSettings> {
    return this.http.get<WholesaleDocumentSettings>(`${this.apiUrl}/document-settings/${docType}`);
  }

  saveDocumentSettings(settings: WholesaleDocumentSettings, docType = 'QUOTATION'): Observable<WholesaleDocumentSettings> {
    return this.http.put<WholesaleDocumentSettings>(`${this.apiUrl}/document-settings/${docType}`, settings);
  }

  // ── Conversion / sales documents ─────────────────────────

  convertQuotation(id: number, request: WholesaleConversionRequest): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/quotations/${id}/convert`, request);
  }

  getSalesDocuments(filters: { type?: string; status?: string; q?: string; from?: string; to?: string } = {}): Observable<WholesaleSalesDocumentSummary[]> {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return this.http.get<WholesaleSalesDocumentSummary[]>(`${this.apiUrl}/sales-documents`, { params });
  }

  getSalesDocument(id: number): Observable<WholesaleSalesDocument> {
    return this.http.get<WholesaleSalesDocument>(`${this.apiUrl}/sales-documents/${id}`);
  }

  /** Any document type (Sales Receipt / Credit Note / Debit Note). */
  previewSalesDocument(request: WholesaleSalesDocumentRequest): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/sales-documents/preview`, request);
  }

  createSalesDocument(request: WholesaleSalesDocumentRequest): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/sales-documents`, request);
  }

  updateSalesDocument(id: number, request: WholesaleSalesDocumentRequest): Observable<WholesaleSalesDocument> {
    return this.http.put<WholesaleSalesDocument>(`${this.apiUrl}/sales-documents/${id}`, request);
  }

  /** All document types with labels and configured semantics. */
  listDocumentSettings(): Observable<WholesaleDocumentSettings[]> {
    return this.http.get<WholesaleDocumentSettings[]>(`${this.apiUrl}/document-settings`);
  }

  previewSalesReceipt(request: WholesaleSalesReceiptRequest): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/sales-receipts/preview`, request);
  }

  createSalesReceipt(request: WholesaleSalesReceiptRequest): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/sales-receipts`, request);
  }

  updateSalesReceipt(id: number, request: WholesaleSalesReceiptRequest): Observable<WholesaleSalesDocument> {
    return this.http.put<WholesaleSalesDocument>(`${this.apiUrl}/sales-receipts/${id}`, request);
  }

  deleteSalesDocumentDraft(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sales-documents/${id}`);
  }

  /** DRAFT → ISSUED, optionally recording the payment received now. */
  issueSalesDocument(id: number, payment?: WholesalePaymentRequest | null): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/sales-documents/${id}/issue`, payment ? { payment } : {});
  }

  addSalesPayment(id: number, payment: WholesalePaymentRequest): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/sales-documents/${id}/payments`, payment);
  }

  voidSalesPayment(id: number, paymentId: number, reason: string): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/sales-documents/${id}/payments/${paymentId}/void`, { reason });
  }

  cancelSalesDocument(id: number, reason: string): Observable<WholesaleSalesDocument> {
    return this.http.post<WholesaleSalesDocument>(`${this.apiUrl}/sales-documents/${id}/cancel`, { reason });
  }

  getPurchases(): Observable<WholesalePurchase[]> {
    return this.http.get<WholesalePurchase[]>(`${this.apiUrl}/purchases`);
  }

  createPurchase(purchase: WholesalePurchaseRequest): Observable<WholesalePurchase> {
    return this.http.post<WholesalePurchase>(`${this.apiUrl}/purchases`, purchase);
  }

  /** Cancels a purchase: stock is reversed through the ledger and the purchase is kept as CANCELLED. */
  cancelPurchase(id: number, reason: string): Observable<WholesalePurchase> {
    return this.http.post<WholesalePurchase>(`${this.apiUrl}/purchases/${id}/cancel`, { reason });
  }

  // ── Inventory ────────────────────────────────────────────

  getCurrentStock(q = '', includeInactive = false, onlyInStock = false): Observable<WholesaleCurrentStockRow[]> {
    return this.http.get<WholesaleCurrentStockRow[]>(`${this.apiUrl}/inventory/stock`, { params: { q, includeInactive, onlyInStock } });
  }

  getStockLedger(f: { productId?: number | null; from?: string; to?: string; type?: string; referenceType?: string; q?: string } = {}): Observable<WholesaleLedgerEntry[]> {
    const params: Record<string, string | number> = {};
    Object.entries(f).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') params[k] = v as any; });
    return this.http.get<WholesaleLedgerEntry[]>(`${this.apiUrl}/inventory/ledger`, { params });
  }

  getProductStockHistory(productId: number, from?: string, to?: string): Observable<WholesaleProductStockHistory> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<WholesaleProductStockHistory>(`${this.apiUrl}/inventory/products/${productId}/history`, { params });
  }

  getStockMovements(from?: string, to?: string, q = '', onlyMoved = true): Observable<WholesaleStockMovementRow[]> {
    const params: Record<string, string | boolean> = { q, onlyMoved };
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<WholesaleStockMovementRow[]>(`${this.apiUrl}/inventory/movements`, { params });
  }

  getStockAdjustments(): Observable<WholesaleStockAdjustment[]> {
    return this.http.get<WholesaleStockAdjustment[]>(`${this.apiUrl}/inventory/adjustments`);
  }

  createStockAdjustment(request: WholesaleStockAdjustmentRequest): Observable<WholesaleStockAdjustment> {
    return this.http.post<WholesaleStockAdjustment>(`${this.apiUrl}/inventory/adjustments`, request);
  }

  getInventorySettings(): Observable<WholesaleInventorySettings> {
    return this.http.get<WholesaleInventorySettings>(`${this.apiUrl}/inventory/settings`);
  }

  saveInventorySettings(allowNegativeStock: boolean): Observable<WholesaleInventorySettings> {
    return this.http.put<WholesaleInventorySettings>(`${this.apiUrl}/inventory/settings`, { allowNegativeStock });
  }

  // ── Instagram customer messaging ──────────────────────────────────────────────────────────────

  getIgConversations(q = '', filter: WholesaleIgFilter = ''): Observable<WholesaleIgConversationSummary[]> {
    return this.http.get<WholesaleIgConversationSummary[]>(`${this.apiUrl}/instagram/conversations`, { params: { q, filter } });
  }

  getIgConversation(id: number): Observable<WholesaleIgConversation> {
    return this.http.get<WholesaleIgConversation>(`${this.apiUrl}/instagram/conversations/${id}`);
  }

  /** Staff reply — switches the conversation to human takeover. Returns the message with status SENT or FAILED. */
  sendIgMessage(id: number, text: string): Observable<WholesaleIgMessage> {
    return this.http.post<WholesaleIgMessage>(`${this.apiUrl}/instagram/conversations/${id}/messages`, { text });
  }

  takeOverIgConversation(id: number): Observable<WholesaleIgConversationSummary> {
    return this.http.post<WholesaleIgConversationSummary>(`${this.apiUrl}/instagram/conversations/${id}/takeover`, {});
  }

  /** Re-enables automatic AI replies. */
  releaseIgConversation(id: number): Observable<WholesaleIgConversationSummary> {
    return this.http.post<WholesaleIgConversationSummary>(`${this.apiUrl}/instagram/conversations/${id}/release`, {});
  }

  markIgConversationRead(id: number): Observable<WholesaleIgConversationSummary> {
    return this.http.post<WholesaleIgConversationSummary>(`${this.apiUrl}/instagram/conversations/${id}/read`, {});
  }

  resolveIgConversation(id: number): Observable<WholesaleIgConversationSummary> {
    return this.http.post<WholesaleIgConversationSummary>(`${this.apiUrl}/instagram/conversations/${id}/resolve`, {});
  }

  linkIgCustomer(id: number, customerId: number | null): Observable<WholesaleIgConversationSummary> {
    return this.http.put<WholesaleIgConversationSummary>(`${this.apiUrl}/instagram/conversations/${id}/customer`, { customerId });
  }

  // ── Wholesale AI assistant ─────────────────────────────────────────────────────────────────────

  /** One assistant turn (dry run: quotations are previewed, nothing is saved or sent). */
  assistantChat(request: WholesaleAssistantChatRequest): Observable<WholesaleAssistantResult> {
    return this.http.post<WholesaleAssistantResult>(`${this.apiUrl}/assistant/chat`, request);
  }

  getAssistantSettings(): Observable<WholesaleAssistantSettings> {
    return this.http.get<WholesaleAssistantSettings>(`${this.apiUrl}/assistant/settings`);
  }

  saveAssistantSettings(settings: WholesaleAssistantSettings): Observable<WholesaleAssistantSettings> {
    return this.http.put<WholesaleAssistantSettings>(`${this.apiUrl}/assistant/settings`, settings);
  }

  getInstagramSettings(): Observable<WholesaleInstagramSettings> {
    return this.http.get<WholesaleInstagramSettings>(`${this.apiUrl}/instagram/settings`);
  }

  saveInstagramSettings(request: WholesaleInstagramSettingsRequest): Observable<WholesaleInstagramSettings> {
    return this.http.put<WholesaleInstagramSettings>(`${this.apiUrl}/instagram/settings`, request);
  }
}
