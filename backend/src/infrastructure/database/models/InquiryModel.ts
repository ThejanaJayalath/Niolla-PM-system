import mongoose, { Schema, Document } from 'mongoose';
import { InquiryStatus } from '../../../domain/entities/Inquiry';

export interface InquiryDocument extends Document {
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes?: string;
  proposals?: {
    _id: string;
    createdAt: Date;
    status: 'CREATED' | 'DOWNLOADED';
  }[];
  status: InquiryStatus;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inquirySchema = new Schema<InquiryDocument>(
  {
    customerName: { type: String, required: true },
    phoneNumber: { type: String, required: true, index: true },
    projectDescription: { type: String, required: true },
    requiredFeatures: [{ type: String }],
    internalNotes: { type: String },
    proposals: [
      {
        _id: { type: String, required: true }, // Using string ID for simplicity or ObjectId if referencing a Proposal collection later
        createdAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['CREATED', 'DOWNLOADED'], default: 'CREATED' },
      },
    ],
    status: {
      type: String,
      enum: ['NEW', 'PROPOSAL_SENT', 'NEGOTIATING', 'CONFIRMED', 'LOST'] as InquiryStatus[],
      default: 'NEW',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const InquiryModel = mongoose.model<InquiryDocument>('Inquiry', inquirySchema);
