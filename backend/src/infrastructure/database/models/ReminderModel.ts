import mongoose, { Schema, Document } from 'mongoose';

export interface ReminderDocument extends Document {
  inquiryId: mongoose.Types.ObjectId;
  type: 'reminder' | 'meeting';
  title: string;
  scheduledAt: Date;
  notes?: string;
  completed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<ReminderDocument>(
  {
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', required: true },
    type: { type: String, enum: ['reminder', 'meeting'], required: true },
    title: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    notes: { type: String },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reminderSchema.index({ inquiryId: 1 });
reminderSchema.index({ scheduledAt: 1 });

export const ReminderModel = mongoose.model<ReminderDocument>('Reminder', reminderSchema);
