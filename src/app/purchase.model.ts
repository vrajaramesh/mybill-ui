import { Supplier } from './supplier.model';
import { Product } from './product.model';

export interface Purchase {
  purchaseId?: number;
  supplier?: Supplier;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  gst?: number;
  finalAmount?: number;
  paidAmount?: number;
  paymentStatus?: string;
  paymentDueDate?: string;
  notes?: string;
  createdAt?: string;
  purchaseItems?: PurchaseItem[];
  purchasePayments?: PurchasePayment[];
}

export interface PurchaseItem {
  purchaseItemId?: number;
  purchase?: Purchase;
  product?: Product;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  gst?: number;
  finalPrice?: number;
}

export interface PurchasePayment {
  paymentId?: number;
  purchase?: Purchase;
  paymentDate: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
}

export interface DebitNoteItem {
  debitNoteItemId?: number;
  purchaseItem?: PurchaseItem;
  product?: Product;
  quantity: number;
  unitPrice?: number;
  gst?: number;
  totalAmount?: number;
  finalAmount?: number;
}

export interface DebitNote {
  debitNoteId?: number;
  noteNumber?: string;
  purchase?: Purchase;
  noteDate: string;
  status?: string;
  reason?: string;
  totalAmount?: number;
  gst?: number;
  finalAmount?: number;
  items: DebitNoteItem[];
}
