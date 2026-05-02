export interface Product {
  productId?: number;
  productName: string;
  description?: string;
  category?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice: number;
  stockQuantity?: number;
  minStockLevel?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
