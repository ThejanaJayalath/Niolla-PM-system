export interface Invoice {
  _id?: string;
  transactionId?: string;
  inquiryId?: string;
  /** Source proposal when this row is generated from a confirmed proposal advance. */
  proposalId?: string;
  clientId: string;
  /** Linked catalog product (denormalized from client when created). */
  productId?: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  taxAmount?: number;
  discountAmt?: number;
  status: 'draft' | 'sent' | 'paid' | 'pending';
  sourceType?: 'PAYMENT' | 'PROPOSAL_ADVANCE';
  /**
   * Income category for paid-funds reporting. Set from source/transaction context:
   * ADVANCE_PAYMENT (proposal advance), MONTHLY_INSTALLMENT (plan installments 1..n-1),
   * BALANCE_PAYMENT (final plan installment).
   */
  invoiceType?: 'ADVANCE_PAYMENT' | 'MONTHLY_INSTALLMENT' | 'BALANCE_PAYMENT';
  description?: string;
  projectName?: string;
  companyName?: string;
  pdfPath?: string;
  emailedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  /** Populated on some API responses when client is joined. */
  clientName?: string;
}
