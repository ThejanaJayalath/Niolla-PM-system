import mongoose, { Schema, Document } from 'mongoose';
import { Project } from '../../../domain/entities/Project';

export interface ProjectDocument extends Document {
  clientId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  expenses: number;
  startDate?: Date;
  endDate?: Date;
  assignedEmployees?: mongoose.Types.ObjectId[];
  assignedEmployeePayouts?: Map<string, number>;
  assignedEmployeePayoutRelease?: Map<string, string>;
  status: 'unassigned' | 'under_development' | 'completed' | 'suspended';
  requirementWorkflowLabel?: 'none' | 'to_be_updated' | 'updated';
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    projectName: { type: String, required: true },
    description: { type: String },
    systemType: { type: String },
    totalValue: { type: Number, required: true },
    expenses: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    assignedEmployees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    assignedEmployeePayouts: { type: Map, of: Number, default: {} },
    assignedEmployeePayoutRelease: {
      type: Map,
      of: String,
      default: {},
    },
    status: {
      type: String,
      enum: ['unassigned', 'under_development', 'completed', 'suspended'],
      default: 'unassigned',
    },
    requirementWorkflowLabel: {
      type: String,
      enum: ['none', 'to_be_updated', 'updated'],
      default: 'none',
    },
  },
  { timestamps: true }
);

projectSchema.index({ status: 1 });
projectSchema.index({ createdAt: -1 });

export const ProjectModel = mongoose.model<ProjectDocument>('Project', projectSchema);
