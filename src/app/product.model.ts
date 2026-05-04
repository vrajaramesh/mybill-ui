export interface ProductCategory {
  categoryId: number;
  categoryName: string;
  description?: string;
}

export interface Product {
  productId?: number;
  productName: string;
  description?: string;
  category?: ProductCategory;
  unit?: string;
  costPrice?: number;
  sellingPrice: number;
  stockQuantity?: number;
  minStockLevel?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
