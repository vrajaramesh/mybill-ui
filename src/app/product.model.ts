export type { ProductCategory, ProductSubCategory } from './product-category.model';
import type { ProductCategory, ProductSubCategory } from './product-category.model';

export interface Product {
  productId?: number;
  productName: string;
  description?: string;
  category?: ProductCategory;
  subCategory?: ProductSubCategory;
  unit?: string;
  costPrice?: number;
  sellingPrice: number;
  stockQuantity?: number;
  minStockLevel?: number;
  isActive?: boolean;
  isOnline?: boolean;
  tags?: string;
  suitableFor?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductImage {
  imageId?: number;
  imageUrl: string;
  publicId?: string;
  imageType?: string;
  mediaType?: string;
  createdAt?: string;
}
