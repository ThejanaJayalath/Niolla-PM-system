import mongoose, { Schema, Document } from 'mongoose';

/** Mirrors project assignment + payout workflow for the Staff_Assignments store. */
export type StaffAssignmentWorkflowStatus = 'InProgress' | 'ReviewRequested' | 'CreditedToWallet';

export interface StaffAssignmentDocument extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  projectName: string;
  agreedPayout: number;
  workflowStatus: StaffAssignmentWorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
}

const staffAssignmentSchema = new Schema<StaffAssignmentDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    projectName: { type: String, required: true },
    agreedPayout: { type: Number, required: true },
    workflowStatus: {
      type: String,
      enum: ['InProgress', 'ReviewRequested', 'CreditedToWallet'],
      required: true,
      index: true,
    },
  },
  { timestamps: true, collection: 'Staff_Assignments' }
);

staffAssignmentSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export const StaffAssignmentModel = mongoose.model<StaffAssignmentDocument>(
  'StaffAssignment',
  staffAssignmentSchema
);
