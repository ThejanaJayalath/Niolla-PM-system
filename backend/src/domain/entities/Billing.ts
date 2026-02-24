export interface BillingItem {
  number?: string;
  description?: string;
  amount: number;
}

export type BillingType = 'NORMAL' | 'ADVANCE' | 'FINAL';

export interface Billing {
  _id?: string;
  billingId: string;
  inquiryId?: string;
  customerName: string;
  projectName?: string;
  phoneNumber?: string;
  items: BillingItem[];
  /** Sum of item amounts (before advance deduction). Stored for PDF. */
  subTotal: number;
  /** Advance applied on this bill (deducted from subTotal). Stored for PDF. */
  advanceApplied: number;
  totalAmount: number;
  billingType: BillingType;
  companyName?: string;
  address?: string;
  email?: string;
  billingDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
