import mongoose, { Schema, Document } from 'mongoose';
import { Customer } from '../../../domain/entities/Customer';

export interface CustomerDocument extends Document {
  customerId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  projects: string[];
  inquiryId?: mongoose.Types.ObjectId;
  address?: string;
  businessType?: string;
  companyName?: string;
  nicNumber?: string;
  status?: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerDocument>(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true, index: true },
    email: { type: String },
    projects: [{ type: String }],
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', default: null },
    address: { type: String },
    businessType: { type: String },
    companyName: { type: String },
    nicNumber: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

export const CustomerModel = mongoose.model<CustomerDocument>('Customer', customerSchema);
