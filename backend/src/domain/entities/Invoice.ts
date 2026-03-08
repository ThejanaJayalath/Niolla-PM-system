export interface Invoice {
  _id?: string;
  transactionId: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  taxAmount?: number;
  discountAmt?: number;
  status: 'draft' | 'sent' | 'paid';
  pdfPath?: string;
  emailedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
