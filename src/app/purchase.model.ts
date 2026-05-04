import { Supplier } from './supplier.model';
import { Product } from './product.model';

export interface Purchase {
  purchaseId?: number;
  supplier?: Supplier;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
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
}

export interface PurchasePayment {
  paymentId?: number;
  purchase?: Purchase;
  paymentDate: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
}
