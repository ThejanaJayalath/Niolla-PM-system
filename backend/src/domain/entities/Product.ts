export interface Product {
  _id?: string;
  productId: string;
  name: string;
  /** Short code for segmentation (e.g. POS, ERP, CRM) */
  code: string;
  description?: string;
  basePricing: number;
  features: string[];
  status: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}
