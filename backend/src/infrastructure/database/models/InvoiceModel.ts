import mongoose, { Schema, Document } from 'mongoose';
import { Invoice } from '../../../domain/entities/Invoice';

export interface InvoiceDocument extends Document {
  transactionId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  taxAmount?: number;
  discountAmt?: number;
  status: 'draft' | 'sent' | 'paid';
  pdfPath?: string;
  emailedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<InvoiceDocument>(
  {
    transactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceDate: { type: Date, required: true },
    totalAmount: { type: Number, required: true },
    taxAmount: { type: Number },
    discountAmt: { type: Number },
    status: { type: String, enum: ['draft', 'sent', 'paid'], default: 'paid' },
    pdfPath: { type: String },
    emailedAt: { type: Date },
  },
  { timestamps: true }
);

invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ clientId: 1, invoiceDate: -1 });

export const InvoiceModel = mongoose.model<InvoiceDocument>('Invoice', invoiceSchema);
