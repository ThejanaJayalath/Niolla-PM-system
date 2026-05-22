export interface Customer {
  _id?: string;
  customerId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  projects: string[];
  inquiryId?: string;
  /** CLIENT fields for payment management */
  address?: string;
  businessType?: string;
  companyName?: string;
  nicNumber?: string;
  status?: 'active' | 'inactive';
  /** Primary product from Product Directory (segmentation) */
  productId?: string;
  productName?: string;
  productCode?: string;
  /** Legacy multi-tag list; kept for inquiry conversion compatibility */
  serviceCategories?: string[];
  /** YYYY-MM-DD — used for birthday card automation */
  dateOfBirth?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
