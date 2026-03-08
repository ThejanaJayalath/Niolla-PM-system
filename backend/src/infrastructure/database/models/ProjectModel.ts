import mongoose, { Schema, Document } from 'mongoose';
import { Project } from '../../../domain/entities/Project';

export interface ProjectDocument extends Document {
  clientId: mongoose.Types.ObjectId;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  startDate?: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    projectName: { type: String, required: true },
    description: { type: String },
    systemType: { type: String },
    totalValue: { type: Number, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  },
  { timestamps: true }
);

projectSchema.index({ status: 1 });
projectSchema.index({ createdAt: -1 });

export const ProjectModel = mongoose.model<ProjectDocument>('Project', projectSchema);
