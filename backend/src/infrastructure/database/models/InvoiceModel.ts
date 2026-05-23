import mongoose, { Schema, Document } from 'mongoose';
import { Invoice } from '../../../domain/entities/Invoice';

export interface InvoiceDocument extends Document {
  transactionId?: mongoose.Types.ObjectId;
  inquiryId?: mongoose.Types.ObjectId;
  proposalId?: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  taxAmount?: number;
  discountAmt?: number;
  status: 'draft' | 'sent' | 'paid' | 'pending';
  sourceType?: 'PAYMENT' | 'PROPOSAL_ADVANCE';
  invoiceType?: 'ADVANCE_PAYMENT' | 'MONTHLY_INSTALLMENT' | 'BALANCE_PAYMENT';
  description?: string;
  projectName?: string;
  companyName?: string;
  pdfPath?: string;
  emailedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<InvoiceDocument>(
  {
    transactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', index: true },
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', index: true },
    proposalId: { type: Schema.Types.ObjectId, ref: 'Proposal', index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceDate: { type: Date, required: true },
    totalAmount: { type: Number, required: true },
    taxAmount: { type: Number },
    discountAmt: { type: Number },
    status: { type: String, enum: ['draft', 'sent', 'paid', 'pending'], default: 'paid' },
    sourceType: { type: String, enum: ['PAYMENT', 'PROPOSAL_ADVANCE'], default: 'PAYMENT', index: true },
    invoiceType: {
      type: String,
      enum: ['ADVANCE_PAYMENT', 'MONTHLY_INSTALLMENT', 'BALANCE_PAYMENT'],
      index: true,
    },
    description: { type: String },
    projectName: { type: String },
    companyName: { type: String },
    pdfPath: { type: String },
    emailedAt: { type: Date },
  },
  { timestamps: true }
);

invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ clientId: 1, invoiceDate: -1 });

export const InvoiceModel = mongoose.model<InvoiceDocument>('Invoice', invoiceSchema);
