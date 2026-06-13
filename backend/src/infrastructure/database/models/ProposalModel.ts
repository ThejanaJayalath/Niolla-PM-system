import mongoose, { Schema, Document } from 'mongoose';
import { ProposalMilestone } from '../../../domain/entities/Proposal';

export interface ProposalDocument extends Document {
  inquiryId: mongoose.Types.ObjectId;
  proposalId: string;
  projectName?: string;
  customerName: string;
  /** Copied from inquiry when present; otherwise empty (optional in product). */
  projectDescription?: string;
  requiredFeatures: string[];
  milestones: ProposalMilestone[];
  advancePayment?: number;
  projectCost?: number;
  originalAmount?: number;
  campaignDiscountAmount?: number;
  campaignId?: mongoose.Types.ObjectId;
  campaignName?: string;
  discountType?: 'percent' | 'flat';
  discountValue?: number;
  totalAmount: number;
  paymentPlan?: 'FULL_PAYMENT' | 'THREE_MONTH' | 'SIX_MONTH';
  installmentMonths?: number;
  monthlyInstallment?: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
  documentPath?: string;
  documentFileName?: string;
  documentGeneratedAt?: Date;
  status?: 'DRAFT' | 'SENT' | 'CONFIRMED' | 'LOST';
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<ProposalMilestone>(
  {
    title: { type: String, required: true },
    description: { type: String },
    amount: { type: Number },
    timePeriod: { type: String },
    dueDate: { type: String },
  },
  { _id: false }
);

const proposalSchema = new Schema<ProposalDocument>(
  {
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', required: true },
    proposalId: { type: String, unique: true },
    projectName: { type: String },
    customerName: { type: String, required: true },
    projectDescription: { type: String, required: true },
    requiredFeatures: [{ type: String }],
    milestones: [milestoneSchema],
    advancePayment: { type: Number },
    projectCost: { type: Number },
    originalAmount: { type: Number },
    campaignDiscountAmount: { type: Number },
    campaignId: { type: Schema.Types.ObjectId, ref: 'FestivalCampaign' },
    campaignName: { type: String },
    discountType: { type: String, enum: ['percent', 'flat'] },
    discountValue: { type: Number },
    totalAmount: { type: Number, required: true },
    paymentPlan: { type: String, enum: ['FULL_PAYMENT', 'THREE_MONTH', 'SIX_MONTH'] },
    installmentMonths: { type: Number },
    monthlyInstallment: { type: Number },
    maintenanceCostPerMonth: { type: Number },
    maintenanceNote: { type: String },
    validUntil: { type: String },
    notes: { type: String },
    documentPath: { type: String },
    documentFileName: { type: String },
    documentGeneratedAt: { type: Date },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'CONFIRMED', 'LOST'],
      default: 'SENT',
      index: true,
    },
  },
  { timestamps: true }
);

export const ProposalModel = mongoose.model<ProposalDocument>('Proposal', proposalSchema);
