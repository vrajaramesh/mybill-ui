import { Customer } from './customer.model';
import { Product } from './product.model';

export interface BillItem {
  billItemId?: number;
  product?: Product;
  itemDescription?: string;
  isMisc?: boolean;         // UI-only flag, not sent to backend
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxableAmount?: number;
  gstPct: number;
  gstAmount?: number;
  totalPrice?: number;
}

export interface Bill {
  billId?: number;
  billNumber?: string;
  billDate: string;
  customer?: Customer;
  subtotal?: number;
  gstAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  paymentMethod: string;
  notes?: string;
  createdAt?: string;
  billItems?: BillItem[];
}