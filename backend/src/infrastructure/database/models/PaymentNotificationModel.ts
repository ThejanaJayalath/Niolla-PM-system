import mongoose, { Schema, Document } from 'mongoose';
import { PaymentNotification } from '../../../domain/entities/PaymentNotification';

export interface PaymentNotificationDocument extends Document {
  clientId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  installmentId?: mongoose.Types.ObjectId;
  type: 'sms' | 'email' | 'system';
  triggerType:
    | 'due_reminder'
    | 'overdue'
    | 'receipt'
    | 'assignment'
    | 'payout_review'
    | 'status_notification'
    | 'requirement_addon'
    | 'birthday'
    | 'anniversary';
  scheduledAt: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
  messageBody?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentNotificationSchema = new Schema<PaymentNotificationDocument>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    installmentId: { type: Schema.Types.ObjectId, ref: 'Installment', index: true },
    type: { type: String, enum: ['sms', 'email', 'system'], required: true },
    triggerType: {
      type: String,
      enum: ['due_reminder', 'overdue', 'receipt', 'assignment', 'payout_review', 'status_notification', 'requirement_addon', 'birthday', 'anniversary'],
      required: true,
      index: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    sentAt: { type: Date },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    messageBody: { type: String },
  },
  { timestamps: true }
);

export const PaymentNotificationModel = mongoose.model<PaymentNotificationDocument>(
  'PaymentNotification',
  paymentNotificationSchema
);
