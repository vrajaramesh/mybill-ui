/** Wholesale domain models — separate from retail Product/Purchase on purpose. */

export type PurchaseType = 'RETAIL' | 'WHOLESALE';

export interface WholesaleProductImage {
  imageId: number;
  imageUrl: string;
  publicId?: string;
  sortOrder: number;
  createdAt?: string;
}

/** No sellingPrice: wholesale prices are decided per sale from quantity and business rules. */
export interface WholesaleProduct {
  wholesaleProductId: number;
  productCode?: string;
  productName: string;
  productType?: string;
  hsnCode?: string;
  description?: string;
  material?: string;
  unit: string;
  availableQuantity: number;
  purchaseRate: number;
  gstPct: number;
  supplierId?: number;
  supplierName?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  images: WholesaleProductImage[];
  /** Active quantity price rules; 0 = no wholesale selling price configured yet. */
  activePriceRuleCount: number;
  fabricType?: string | null;
  availableColors?: string | null;
  availableDesigns?: string | null;
  specifications?: string | null;
  aiInstructions?: string | null;
}

export interface WholesaleProductRequest {
  productCode?: string;
  productName: string;
  productType?: string;
  hsnCode?: string;
  description?: string;
  material?: string;
  unit: string;
  purchaseRate?: number;
  gstPct?: number;
  supplierId?: number;
  isActive?: boolean;
  /** Customer-facing knowledge for the AI assistant. Colours / designs comma separated; specifications "Name: Value" per line. */
  fabricType?: string | null;
  availableColors?: string | null;
  availableDesigns?: string | null;
  specifications?: string | null;
  aiInstructions?: string | null;
}

export interface WholesalePurchaseItemRequest {
  wholesaleProductId?: number;
  newProduct?: WholesaleProductRequest;
  quantity: number;
  purchaseRate: number;
  gstPct: number;
}

export interface WholesalePurchaseRequest {
  supplierId: number;
  invoiceNumber: string;
  invoiceDate: string;
  interstate: boolean;
  paidAmount?: number;
  paymentDueDate?: string;
  notes?: string;
  items: WholesalePurchaseItemRequest[];
}

export interface WholesalePurchaseItem {
  wholesalePurchaseItemId: number;
  wholesaleProductId: number;
  productCode?: string;
  productName: string;
  unit: string;
  hsnCode?: string;
  quantity: number;
  purchaseRate: number;
  gstPct: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface WholesalePurchase {
  wholesalePurchaseId: number;
  supplierId: number;
  supplierName: string;
  supplierGstNumber?: string;
  invoiceNumber: string;
  invoiceDate: string;
  interstate: boolean;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  paymentDueDate?: string;
  notes?: string;
  createdAt?: string;
  items: WholesalePurchaseItem[];
  /** Purchases are cancelled (stock reversed), never deleted. */
  status: 'ACTIVE' | 'CANCELLED';
  createdBy?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
}

/** Quantity slab: [minQuantity, maxQuantity] inclusive (max empty = "and above") -> price per unit excl. GST. */
export interface WholesalePriceRule {
  priceRuleId: number;
  wholesaleProductId: number;
  minQuantity: number;
  maxQuantity?: number | null;
  price: number;
  /** Empty = the product's GST % applies. */
  gstPct?: number | null;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WholesalePriceRuleRequest {
  minQuantity: number;
  maxQuantity?: number | null;
  price: number;
  gstPct?: number | null;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
}

export interface WholesalePriceQuote {
  wholesaleProductId: number;
  productName: string;
  unit: string;
  quantity: number;
  priceDate: string;
  priceRuleId: number;
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
  gstPct: number;
  gstSource: 'RULE' | 'PRODUCT';
  interstate: boolean;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  totalAmount: number;
  availableQuantity: number;
  sufficientStock: boolean;
}

/** Line amounts, mirroring the backend WholesaleTaxCalculator (tax-exclusive rates). */
export interface WholesaleLineTax {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  total: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeWholesaleLineTax(quantity: number, rate: number, gstPct: number, interstate: boolean): WholesaleLineTax {
  const taxable = round2((Number(quantity) || 0) * (Number(rate) || 0));
  const gst = round2(taxable * (Number(gstPct) || 0) / 100);
  if (interstate) return { taxable, cgst: 0, sgst: 0, igst: gst, gst, total: round2(taxable + gst) };
  const cgst = Math.floor(Math.round(gst * 100) / 2) / 100; // odd paisa goes to SGST, as on the backend
  return { taxable, cgst, sgst: round2(gst - cgst), igst: 0, gst, total: round2(taxable + gst) };
}

/** Default is RETAILER. */
export type WholesaleCustomerType = 'WHOLESALE' | 'RETAILER';

/** B2B customer for wholesale documents. Separate from the retail Customer model. */
export interface WholesaleCustomer {
  wholesaleCustomerId: number;
  customerName: string;
  businessName?: string | null;
  customerType: WholesaleCustomerType;
  customerTypeLabel: string;
  gstNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  billingAddress?: string | null;
  city?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  pinCode?: string | null;
  shippingSameAsBilling: boolean;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingStateCode?: string | null;
  shippingStateName?: string | null;
  shippingPinCode?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WholesaleCustomerRequest {
  customerName: string;
  businessName?: string;
  customerType: WholesaleCustomerType;
  gstNumber?: string;
  phone?: string;
  email?: string;
  billingAddress?: string;
  city?: string;
  stateCode?: string;
  pinCode?: string;
  shippingSameAsBilling: boolean;
  shippingAddress?: string;
  shippingCity?: string;
  shippingStateCode?: string;
  shippingPinCode?: string;
  notes?: string;
  isActive: boolean;
}

export interface WholesaleCustomerMatch {
  wholesaleCustomerId: number;
  customerName: string;
  businessName?: string | null;
  gstNumber?: string | null;
  phone?: string | null;
  city?: string | null;
  isActive: boolean;
  reasons: string[];
  /** true = same GSTIN; the save will be rejected. */
  blocking: boolean;
}

export interface WholesaleOption { value: string; label: string; }

export interface WholesaleCustomerOptions {
  customerTypes: WholesaleOption[];
  states: WholesaleOption[];
}

// ── Wholesale business profile (Settings → Wholesale Business Profile / Bank / UPI) ──

export interface WholesaleProfileDetails {
  firmName: string;
  address: string;
  city?: string | null;
  stateCode: string;
  stateName?: string | null;
  pinCode?: string | null;
  gstNumber?: string | null;
  phone: string;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  logoPublicId?: string | null;
}

export interface WholesaleBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  branch?: string | null;
}

export interface WholesaleUpiDetails {
  upiId: string;
  qrImageUrl?: string | null;
  qrPublicId?: string | null;
}

export interface WholesaleProfileReadiness {
  documentReady: boolean;
  gstRegistered: boolean;
  bankConfigured: boolean;
  upiConfigured: boolean;
  missing: string[];
  warnings: string[];
}

/** details/bank/upi are null until first saved. */
export interface WholesaleBusinessProfile {
  details: WholesaleProfileDetails | null;
  bank: WholesaleBankDetails | null;
  upi: WholesaleUpiDetails | null;
  readiness: WholesaleProfileReadiness;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/** Print-ready letterhead + payment block shared by quotation, credit invoice, sales receipt and debit note. */
export interface WholesaleDocumentProfile {
  firmName: string;
  addressLines: string[];
  stateCode: string;
  stateName: string;
  gstNumber?: string | null;
  phone: string;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  bank?: WholesaleBankDetails | null;
  upi?: { upiId: string; payeeName: string; qrImageUrl?: string | null } | null;
}

// ── Quotations ─────────────────────────────────────────────

export type WholesaleQuotationStatus = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED';
export type WholesaleQuotationAction = 'EDIT' | 'DELETE' | 'ISSUE' | 'ACCEPT' | 'REJECT' | 'CANCEL' | 'DUPLICATE' | 'CONVERT' | 'PRINT' | 'PDF' | 'SHARE';

export interface WholesaleQuotationItemRequest {
  wholesaleProductId: number;
  quantity: number;
  /** null = use the applicable quantity price rule (server decides). */
  rate: number | null;
  discountPct?: number | null;
  /** null = rule GST %, else product GST %. */
  gstPct?: number | null;
  description?: string | null;
}

export interface WholesaleQuotationRequest {
  customerId: number;
  quotationDate: string;
  validUntil?: string | null;
  otherChargesLabel?: string | null;
  otherChargesAmount?: number | null;
  otherChargesGstPct?: number | null;
  notes?: string | null;
  terms?: string | null;
  items: WholesaleQuotationItemRequest[];
}

export interface WholesaleQuotationItem {
  quotationItemId?: number | null;
  lineNo: number;
  wholesaleProductId: number;
  itemName: string;
  productCode?: string | null;
  hsnCode?: string | null;
  unit: string;
  description?: string | null;
  quantity: number;
  rate: number;
  rateSource: 'RULE' | 'MANUAL';
  ruleRate?: number | null;
  priceRuleId?: number | null;
  discountPct: number;
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  gstPct: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  totalAmount: number;
  availableQuantity?: number | null;
}

export interface WholesaleQuotationCustomer {
  wholesaleCustomerId: number;
  customerName: string;
  businessName?: string | null;
  gstNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  billingAddress?: string | null;
  billingCity?: string | null;
  billingStateCode?: string | null;
  billingStateName?: string | null;
  billingPinCode?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingStateCode?: string | null;
  shippingStateName?: string | null;
  shippingPinCode?: string | null;
}

export interface WholesaleQuotationTotals {
  grossAmount: number;
  discountAmount: number;
  subtotal: number;
  otherChargesLabel?: string | null;
  otherChargesAmount: number;
  otherChargesGstPct: number;
  otherChargesGstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  roundOff: number;
  grandTotal: number;
}

export interface WholesaleQuotation {
  quotationId: number | null;
  quotationNumber?: string | null;
  displayNumber: string;
  status: WholesaleQuotationStatus;
  quotationDate: string;
  validUntil: string;
  firm: WholesaleDocumentProfile;
  customer: WholesaleQuotationCustomer;
  placeOfSupplyStateCode?: string | null;
  interstate: boolean;
  items: WholesaleQuotationItem[];
  totals: WholesaleQuotationTotals;
  notes?: string | null;
  terms?: string | null;
  duplicatedFromId?: number | null;
  cancelReason?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  issuedAt?: string | null;
  issuedBy?: string | null;
  statusChangedAt?: string | null;
  statusChangedBy?: string | null;
  allowedActions: WholesaleQuotationAction[];
  warnings: string[];
  conversionStatus: 'NOT_CONVERTED' | 'CONVERTED' | 'CONVERSION_CANCELLED';
  conversions: WholesaleQuotationConversion[];
}

export interface WholesaleQuotationSummary {
  quotationId: number;
  quotationNumber?: string | null;
  displayNumber: string;
  status: WholesaleQuotationStatus;
  quotationDate: string;
  validUntil: string;
  wholesaleCustomerId: number;
  customerName: string;
  customerBusinessName?: string | null;
  grandTotal: number;
}

export interface WholesaleDocumentSettings {
  docType: string;
  prefix: string;
  separator: string;
  includeFinancialYear: boolean;
  resetEachFinancialYear: boolean;
  numberPadding: number;
  defaultValidityDays: number;
  defaultTerms?: string | null;
  currentPeriod?: string;
  lastNumber?: number;
  nextNumberPreview?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  /** Credit Notes: days until payment is due. */
  defaultDueDays?: number;
  /** Request only: continue numbering from this value in the current period. */
  nextNumber?: number | null;
  // Configurable semantics (sales documents). Copied onto each document when issued.
  displayLabel?: string | null;
  printTitle?: string | null;
  gstClassification?: WholesaleGstClassification;
  valueEffect?: WholesaleValueEffect;
  stockEffect?: WholesaleStockEffect;
  referenceMode?: WholesaleReferenceMode;
  allowedReferenceTypes?: string[];
  reasonRequired?: boolean;
}

// ── Quotation conversion → Sales Receipt / Credit Note ─────

export type WholesaleSalesDocumentType = 'SALES_RECEIPT' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
export type WholesaleValueEffect = 'CHARGE' | 'CREDIT';
export type WholesaleStockEffect = 'OUT' | 'IN' | 'NONE';
export type WholesaleReferenceMode = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export type WholesaleGstClassification = 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'RECEIPT_VOUCHER' | 'OTHER';
export type WholesalePaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE';

/** DRAFT → ISSUED → PARTIALLY_PAID → PAID, or CANCELLED. */
export type WholesaleSalesDocumentStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface WholesaleQuotationConversion {
  salesDocumentId: number;
  docType: WholesaleSalesDocumentType;
  docTypeLabel: string;
  documentNumber: string;
  documentDate: string;
  status: WholesaleSalesDocumentStatus;
  grandTotal: number;
  convertedAt?: string | null;
  convertedBy?: string | null;
}

export interface WholesaleConversionRequest {
  convertTo: WholesaleSalesDocumentType;
  documentDate?: string | null;
  paymentMode?: WholesalePaymentMode | null;
  paymentReference?: string | null;
  /** Sales Receipt: amount received now (default full). */
  amountReceived?: number | null;
  dueDate?: string | null;
  notes?: string | null;
  allowDuplicate?: boolean;
}

export interface WholesalePaymentRequest {
  paymentDate?: string | null;
  amount: number;
  paymentMode: WholesalePaymentMode;
  reference?: string | null;
  notes?: string | null;
}

export interface WholesalePaymentRecord {
  paymentId: number;
  paymentDate: string;
  amount: number;
  paymentMode: WholesalePaymentMode;
  reference?: string | null;
  notes?: string | null;
  status: 'RECORDED' | 'VOIDED';
  createdAt?: string | null;
  createdBy?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
}

/** Any sales document draft (Sales Receipt / Credit Note / Debit Note). One reference at most. */
export interface WholesaleSalesDocumentRequest {
  docType: WholesaleSalesDocumentType;
  customerId: number;
  documentDate: string;
  referenceDocumentId?: number | null;
  referenceQuotationId?: number | null;
  externalReferenceNumber?: string | null;
  externalReferenceDate?: string | null;
  reason?: string | null;
  dueDate?: string | null;
  otherChargesLabel?: string | null;
  otherChargesAmount?: number | null;
  otherChargesGstPct?: number | null;
  notes?: string | null;
  terms?: string | null;
  items: WholesaleQuotationItemRequest[];
}

/** Same line format as quotations; rate null = quantity slab on the receipt date. */
export interface WholesaleSalesReceiptRequest {
  customerId: number;
  receiptDate: string;
  otherChargesLabel?: string | null;
  otherChargesAmount?: number | null;
  otherChargesGstPct?: number | null;
  notes?: string | null;
  terms?: string | null;
  items: WholesaleQuotationItemRequest[];
}

export interface WholesaleSalesDocumentItem {
  salesDocumentItemId: number;
  lineNo: number;
  sourceQuotationItemId?: number | null;
  wholesaleProductId: number;
  itemName: string;
  productCode?: string | null;
  hsnCode?: string | null;
  unit: string;
  description?: string | null;
  quantity: number;
  rate: number;
  rateSource: string;
  discountPct: number;
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  gstPct: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface WholesaleSalesDocument {
  salesDocumentId: number;
  docType: WholesaleSalesDocumentType;
  docTypeLabel: string;
  printTitle: string;
  documentNumber: string;
  documentDate: string;
  status: WholesaleSalesDocumentStatus;
  sourceQuotationId?: number | null;
  sourceQuotationNumber?: string | null;
  /** Meaning this document was issued under (from configuration, frozen at issue). */
  semantics: { gstClassification: WholesaleGstClassification; valueEffect: WholesaleValueEffect; stockEffect: WholesaleStockEffect };
  reference?: { docType: string; documentId?: number | null; quotationId?: number | null; number: string; date?: string | null } | null;
  reason?: string | null;
  firm: WholesaleDocumentProfile;
  customer: WholesaleQuotationCustomer;
  placeOfSupplyStateCode?: string | null;
  interstate: boolean;
  items: WholesaleSalesDocumentItem[];
  totals: WholesaleQuotationTotals;
  payment: {
    paymentMode?: WholesalePaymentMode | null;
    paymentReference?: string | null;
    amountPaid: number;
    paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
    dueDate?: string | null;
    balanceDue: number;
  };
  notes?: string | null;
  terms?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  issuedAt?: string | null;
  issuedBy?: string | null;
  convertedAt?: string | null;
  convertedBy?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  payments: WholesalePaymentRecord[];
  auditTrail: { eventType: string; eventAt: string; eventBy?: string | null; details?: string | null }[];
  allowedActions: string[];
  warnings: string[];
}

export interface WholesaleSalesDocumentSummary {
  salesDocumentId: number;
  docType: WholesaleSalesDocumentType;
  docTypeLabel: string;
  documentNumber: string;
  documentDate: string;
  status: WholesaleSalesDocumentStatus;
  wholesaleCustomerId: number;
  customerName: string;
  customerBusinessName?: string | null;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
  paymentMode?: WholesalePaymentMode | null;
  dueDate?: string | null;
  sourceQuotationId?: number | null;
  sourceQuotationNumber?: string | null;
  referenceNumber?: string | null;
  valueEffect: WholesaleValueEffect;
}

// ── Wholesale inventory ────────────────────────────────────

export type WholesaleInventoryTransactionType = 'OPENING' | 'PURCHASE' | 'SALE' | 'CREDIT' | 'DEBIT' | 'RETURN' | 'ADJUSTMENT' | 'REVERSAL';

export interface WholesaleCurrentStockRow {
  wholesaleProductId: number;
  productCode?: string | null;
  productName: string;
  productType?: string | null;
  unit: string;
  isActive: boolean;
  availableQuantity: number;
  /** Σ in − Σ out from the ledger; inSync = equals availableQuantity. */
  ledgerQuantity: number;
  inSync: boolean;
  purchaseRate: number;
  stockValue: number;
  lastMovementDate?: string | null;
}

export interface WholesaleLedgerEntry {
  ledgerId: number;
  wholesaleProductId: number;
  productCode?: string | null;
  productName: string;
  unit: string;
  transactionType: WholesaleInventoryTransactionType;
  referenceType: 'PURCHASE' | 'SALES_RECEIPT' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'STOCK_ADJUSTMENT';
  referenceId: number;
  referenceNumber?: string | null;
  reversesLedgerId?: number | null;
  quantityIn: number;
  quantityOut: number;
  balanceQuantity: number;
  rate?: number | null;
  transactionDate: string;
  notes?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
}

export interface WholesaleStockMovementRow {
  wholesaleProductId: number;
  productCode?: string | null;
  productName: string;
  unit: string;
  openingQuantity: number;
  quantityIn: number;
  quantityOut: number;
  closingQuantity: number;
}

export interface WholesaleProductStockHistory {
  wholesaleProductId: number;
  productCode?: string | null;
  productName: string;
  unit: string;
  availableQuantity: number;
  fromDate?: string | null;
  toDate: string;
  openingQuantity: number;
  totalIn: number;
  totalOut: number;
  closingQuantity: number;
  entries: WholesaleLedgerEntry[];
}

export interface WholesaleStockAdjustment {
  adjustmentId: number;
  adjustmentNumber: string;
  adjustmentDate: string;
  reason: string;
  isOpening: boolean;
  createdAt?: string | null;
  createdBy?: string | null;
  items: { wholesaleProductId: number; productName: string; unit: string; quantityChange: number; notes?: string | null }[];
}

export interface WholesaleStockAdjustmentRequest {
  adjustmentDate: string;
  reason: string;
  items: { wholesaleProductId: number; quantityChange: number; notes?: string | null }[];
}

export interface WholesaleInventorySettings {
  allowNegativeStock: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

// ── Instagram customer messaging (Phase 11) ─────────────────────────────────────────────────────

export type WholesaleIgFilter = '' | 'ATTENTION' | 'TAKEOVER' | 'UNREAD';

export interface WholesaleIgConversationSummary {
  conversationId: number;
  instagramUserId: string;
  instagramUsername?: string | null;
  displayName?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  aiEnabled: boolean;
  takeoverBy?: string | null;
  takeoverAt?: string | null;
  needsAttention: boolean;
  attentionReason?: string | null;
  unreadCount: number;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
  lastInboundAt?: string | null;
  replyWindowOpen: boolean;
}

export interface WholesaleIgMessage {
  messageId: number;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType: 'CUSTOMER' | 'AI' | 'STAFF';
  messageText?: string | null;
  attachments?: { type?: string; payload?: { url?: string } }[] | null;
  intent?: string | null;
  extracted?: Record<string, unknown> | null;
  facts?: Record<string, unknown> | null;
  aiResponse?: string | null;
  replyMessageId?: number | null;
  status: string;
  errorMessage?: string | null;
  sentBy?: string | null;
  messageAt: string;
}

export interface WholesaleIgConversation {
  conversation: WholesaleIgConversationSummary;
  messages: WholesaleIgMessage[];
}

export interface WholesaleInstagramSettings {
  isEnabled: boolean;
  autoReplyEnabled: boolean;
  instagramAccountId?: string | null;
  apiBaseUrl: string;
  accessTokenSet: boolean;
  appSecretSet: boolean;
  verifyToken?: string | null;
  handoffMessage: string;
  webhookPath?: string | null;
  aiConfigured: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/** accessToken / appSecret: null = keep the stored value, '' = clear. */
export interface WholesaleInstagramSettingsRequest {
  isEnabled: boolean;
  autoReplyEnabled: boolean;
  instagramAccountId: string | null;
  apiBaseUrl: string;
  accessToken: string | null;
  appSecret: string | null;
  verifyToken: string | null;
  handoffMessage: string;
}

export type WholesaleAssistantRole = 'CUSTOMER' | 'ASSISTANT' | 'STAFF';

export interface WholesaleAssistantToolCall {
  tool: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface WholesaleAssistantResult {
  reply: string;
  /** AI = model reply verified against tool results; UNKNOWN = "don't have that information"; ERROR = AI unavailable. */
  replySource: 'AI' | 'UNKNOWN' | 'ERROR';
  intent: string;
  answered: boolean;
  confidence: 'high' | 'low';
  needsHuman: boolean;
  attentionReason?: string | null;
  toolCalls: WholesaleAssistantToolCall[];
  /** productId, productName, unit, quantity, quantityUnit, quotationRef … — send back with the next turn. */
  context: Record<string, unknown>;
  quotation?: Record<string, unknown> | null;
}

export interface WholesaleAssistantChatRequest {
  message: string;
  history: { role: WholesaleAssistantRole; text: string }[];
  context: Record<string, unknown>;
  customerId?: number | null;
}

export interface WholesaleAssistantSettings {
  orderingProcess?: string | null;
  shippingInfo?: string | null;
  paymentTerms?: string | null;
  businessHours?: string | null;
  additionalInfo?: string | null;
  unknownReply: string;
  shareStockQuantity: boolean;
  allowQuotationDrafts: boolean;
  autoIssueQuotations: boolean;
  aiConfigured?: boolean;
  model?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}
