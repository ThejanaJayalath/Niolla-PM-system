export interface Invoice {
  _id?: string;
  transactionId?: string;
  inquiryId?: string;
  /** Source proposal when this row is generated from a confirmed proposal advance. */
  proposalId?: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  taxAmount?: number;
  discountAmt?: number;
  status: 'draft' | 'sent' | 'paid' | 'pending';
  sourceType?: 'PAYMENT' | 'PROPOSAL_ADVANCE';
  description?: string;
  projectName?: string;
  companyName?: string;
  pdfPath?: string;
  emailedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
