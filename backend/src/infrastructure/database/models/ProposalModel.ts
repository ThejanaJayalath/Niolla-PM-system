import mongoose, { Schema, Document } from 'mongoose';
import { ProposalMilestone } from '../../../domain/entities/Proposal';

export interface ProposalDocument extends Document {
  inquiryId: mongoose.Types.ObjectId;
  projectName?: string;
  customerName: string;
  projectDescription: string;
  requiredFeatures: string[];
  milestones: ProposalMilestone[];
  advancePayment?: number;
  projectCost?: number;
  totalAmount: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
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
    projectName: { type: String },
    customerName: { type: String, required: true },
    projectDescription: { type: String, required: true },
    requiredFeatures: [{ type: String }],
    milestones: [milestoneSchema],
    advancePayment: { type: Number },
    projectCost: { type: Number },
    totalAmount: { type: Number, required: true },
    maintenanceCostPerMonth: { type: Number },
    maintenanceNote: { type: String },
    validUntil: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

export const ProposalModel = mongoose.model<ProposalDocument>('Proposal', proposalSchema);
