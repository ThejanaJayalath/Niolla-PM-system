import mongoose, { Schema, Document } from 'mongoose';

export interface ReminderDocument extends Document {
  inquiryId?: mongoose.Types.ObjectId;
  customerName?: string;
  type: 'reminder' | 'meeting';
  title: string;
  description?: string;
  meetingLink?: string;
  googleEventId?: string;
  scheduledAt: Date;
  notes?: string;
  status: 'schedule' | 'overdue' | 'done' | 'cancel' | 'postpone';
  completed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<ReminderDocument>(
  {
    inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry' },
    customerName: { type: String },
    type: { type: String, enum: ['reminder', 'meeting'], required: true },
    title: { type: String, required: true },
    description: { type: String },
    meetingLink: { type: String },
    googleEventId: { type: String },
    scheduledAt: { type: Date, required: true },
    notes: { type: String },
    status: {
      type: String,
      enum: ['schedule', 'overdue', 'done', 'cancel', 'postpone'],
      default: 'schedule',
    },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reminderSchema.index({ inquiryId: 1 });
reminderSchema.index({ scheduledAt: 1 });

export const ReminderModel = mongoose.model<ReminderDocument>('Reminder', reminderSchema);
