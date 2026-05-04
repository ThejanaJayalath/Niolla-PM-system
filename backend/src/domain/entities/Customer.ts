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
  /** NIOLLA NEXA: Web, Mobile App, ERP, POS, Other */
  serviceCategories?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
