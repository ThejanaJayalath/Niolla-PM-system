import mongoose, { Schema, Document } from 'mongoose';

export interface ProjectTaskDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  requirementId?: mongoose.Types.ObjectId;
  updateTicketId?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  assigneeIds: mongoose.Types.ObjectId[];
  completed: boolean;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectTaskSchema = new Schema<ProjectTaskDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    requirementId: { type: Schema.Types.ObjectId, ref: 'CustomerRequirement', index: true },
    updateTicketId: { type: Schema.Types.ObjectId, ref: 'UpdateTicket', index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assigneeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    completed: { type: Boolean, default: false, index: true },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

projectTaskSchema.index({ projectId: 1, completed: 1, createdAt: -1 });
projectTaskSchema.index({ assigneeIds: 1, completed: 1 });

export const ProjectTaskModel = mongoose.model<ProjectTaskDocument>('ProjectTask', projectTaskSchema);
