import mongoose, { Schema, Document } from 'mongoose';
import { BillingItem, BillingType } from '../../../domain/entities/Billing';

export interface BillingDocument extends Document {
  billingId: string;
  inquiryId?: mongoose.Types.ObjectId;
  customerName: string;
  projectName?: string;
  phoneNumber?: string;
  items: BillingItem[];
  subTotal: number;
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

const billingItemSchema = new Schema<BillingItem>(
  {
    number: { type: String },
    description: { type: String },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const billingSchema = new Schema<BillingDocument>(
  {
    billingId: { type: String, required: true, unique: true },
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry' },
    customerName: { type: String, required: true },
    projectName: { type: String },
    phoneNumber: { type: String },
    items: [billingItemSchema],
    subTotal: { type: Number, default: 0 },
    advanceApplied: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    billingType: { type: String, enum: ['NORMAL', 'ADVANCE', 'FINAL'], default: 'NORMAL' },
    companyName: { type: String },
    address: { type: String },
    email: { type: String },
    billingDate: { type: Date, required: true },
  },
  { timestamps: true }
);

billingSchema.index({ billingId: 1 });
billingSchema.index({ inquiryId: 1 });
billingSchema.index({ createdAt: -1 });

export const BillingModel = mongoose.model<BillingDocument>('Billing', billingSchema);
