import mongoose, { Schema, Document } from 'mongoose';
import { UpdateTicketStatus } from '../../../domain/entities/UpdateTicket';

export interface UpdateTicketDocument extends Document {
  ticketId: string;
  customerRef: mongoose.Types.ObjectId;
  projectRef: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: UpdateTicketStatus;
  quotedPrice?: number;
  pricedAt?: Date;
  pricedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  assignedEmployeeIds?: mongoose.Types.ObjectId[];
  developerPayoutValue?: number;
  assignedAt?: Date;
  assignedBy?: mongoose.Types.ObjectId;
  linkedRequirementId?: mongoose.Types.ObjectId;
  linkedPaymentPlanId?: mongoose.Types.ObjectId;
  requestedAt: Date;
  workerSubmittedAt?: Date;
  completedAt?: Date;
  /** Worker who marked the update complete. */
  completedByWorker?: mongoose.Types.ObjectId;
  adminApprovedAt?: Date;
  adminApprovedBy?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const updateTicketSchema = new Schema<UpdateTicketDocument>(
  {
    ticketId: { type: String, required: true, unique: true, trim: true, index: true },
    customerRef: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    projectRef: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['REQUESTED', 'PRICED', 'APPROVED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED'],
      default: 'REQUESTED',
      index: true,
    },
    quotedPrice: { type: Number, min: 0 },
    pricedAt: { type: Date },
    pricedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedEmployeeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    developerPayoutValue: { type: Number, min: 0 },
    assignedAt: { type: Date },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    linkedRequirementId: { type: Schema.Types.ObjectId, ref: 'CustomerRequirement', index: true },
    linkedPaymentPlanId: { type: Schema.Types.ObjectId, ref: 'PaymentPlan', index: true },
    requestedAt: { type: Date, required: true, default: Date.now, index: true },
    workerSubmittedAt: { type: Date },
    completedAt: { type: Date },
    completedByWorker: { type: Schema.Types.ObjectId, ref: 'User' },
    adminApprovedAt: { type: Date },
    adminApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    internalNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

updateTicketSchema.index({ customerRef: 1, requestedAt: -1 });
updateTicketSchema.index({ projectRef: 1, requestedAt: -1 });

export const UpdateTicketModel = mongoose.model<UpdateTicketDocument>('UpdateTicket', updateTicketSchema);
