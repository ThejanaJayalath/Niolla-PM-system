export interface BillingItem {
  number?: string;
  description?: string;
  amount: number;
}

export interface Billing {
  _id?: string;
  billingId: string;
  inquiryId?: string;
  customerName: string;
  projectName?: string;
  phoneNumber?: string;
  items: BillingItem[];
  totalAmount: number;
  companyName?: string;
  address?: string;
  email?: string;
  billingDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
