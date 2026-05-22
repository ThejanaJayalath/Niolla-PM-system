import mongoose, { Schema, Document } from 'mongoose';
import { InquiryStatus } from '../../../domain/entities/Inquiry';
import { SequenceModel } from './SequenceModel';

export interface InquiryDocument extends Document {
  customerId: string;
  customerName: string;
  companyName?: string;
  phoneNumber: string;
  businessModel?: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes?: string;
  proposals?: {
    _id: string;
    createdAt: Date;
    status: 'CREATED' | 'DOWNLOADED' | 'CONFIRMED';
    projectName?: string;
  }[];
  status: InquiryStatus;
  totalAdvancePaid: number;
  totalAdvanceUsed: number;
  createdBy?: mongoose.Types.ObjectId;
  dateOfBirth?: string;
  createdAt: Date;
  updatedAt: Date;
}

const inquirySchema = new Schema<InquiryDocument>(
  {
    customerId: {
      type: String,
      unique: true,
      index: true
    },
    customerName: { type: String, required: true },
    companyName: { type: String, trim: true, index: true },
    phoneNumber: { type: String, required: true, index: true },
    businessModel: { type: String, trim: true, index: true },
    projectDescription: { type: String, default: '' },
    requiredFeatures: [{ type: String }],
    internalNotes: { type: String },
    proposals: [
      {
        _id: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['CREATED', 'DOWNLOADED', 'CONFIRMED'], default: 'CREATED' },
        projectName: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ['NEW', 'PROPOSAL_SENT', 'NEGOTIATING', 'PENDING_ADVANCE', 'CONFIRMED', 'LOST'] as InquiryStatus[],
      default: 'NEW',
    },
    totalAdvancePaid: { type: Number, default: 0 },
    totalAdvanceUsed: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    dateOfBirth: { type: String, trim: true },
  },
  { timestamps: true }
);

const INQUIRY_SEQUENCE_KEY = 'inquiry_customer_id';

async function getCurrentMaxInquiryNumber(): Promise<number> {
  const [row] = await InquiryModel.aggregate<{ maxNum: number }>([
    {
      $match: {
        customerId: { $type: 'string' },
      },
    },
    {
      $project: {
        parsed: {
          $cond: [
            { $regexMatch: { input: '$customerId', regex: /^INQ-\d+$/ } },
            { $toInt: { $substrBytes: ['$customerId', 4, -1] } },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        maxNum: { $max: '$parsed' },
      },
    },
  ]);
  return Number.isFinite(row?.maxNum) ? row.maxNum : 0;
}

async function getNextInquiryNumber(): Promise<number> {
  const maxExisting = await getCurrentMaxInquiryNumber();
  await SequenceModel.findOneAndUpdate(
    { _id: INQUIRY_SEQUENCE_KEY },
    { $setOnInsert: { seq: maxExisting } },
    { upsert: true, new: true }
  );
  const counter = await SequenceModel.findOneAndUpdate(
    { _id: INQUIRY_SEQUENCE_KEY },
    { $inc: { seq: 1 } },
    { new: true }
  );
  return counter?.seq || maxExisting + 1;
}

// Auto-generate customerId before saving (atomic, safe for concurrent requests)
inquirySchema.pre('save', async function (next) {
  if (!this.customerId) {
    const nextNum = await getNextInquiryNumber();
    this.customerId = `INQ-${String(nextNum).padStart(5, '0')}`;
  }
  next();
});

export const InquiryModel = mongoose.model<InquiryDocument>('Inquiry', inquirySchema);
