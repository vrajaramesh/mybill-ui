export interface ProductCategory {
  categoryName: string;
  isOnline: boolean;
}

export interface ProductSubCategory {
  id?: number;
  subCatName: string;
  category?: ProductCategory;
  isOnline: boolean;
}
