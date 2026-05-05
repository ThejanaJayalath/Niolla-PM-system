import mongoose, { Schema, Document } from 'mongoose';
import { RequirementPriority, RequirementSource, RequirementStatus } from '../../../domain/entities/CustomerRequirement';

export interface CustomerRequirementDocument extends Document {
  customerRef: mongoose.Types.ObjectId;
  inquiryRef?: mongoose.Types.ObjectId;
  projectRef?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  priority: RequirementPriority;
  status: RequirementStatus;
  source: RequirementSource;
  capturedAt: Date;
  capturedBy?: mongoose.Types.ObjectId;
  lastUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const customerRequirementSchema = new Schema<CustomerRequirementDocument>(
  {
    customerRef: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    inquiryRef: { type: Schema.Types.ObjectId, ref: 'Inquiry', index: true },
    projectRef: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM', index: true },
    status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'DONE', 'DEFERRED'], default: 'OPEN', index: true },
    source: { type: String, enum: ['INQUIRY', 'CALL', 'MEETING', 'MANUAL'], default: 'MANUAL' },
    capturedAt: { type: Date, required: true, default: Date.now, index: true },
    capturedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

customerRequirementSchema.index({ customerRef: 1, capturedAt: -1 });
customerRequirementSchema.index({ customerRef: 1, status: 1, priority: -1 });

export const CustomerRequirementModel = mongoose.model<CustomerRequirementDocument>('CustomerRequirement', customerRequirementSchema);
