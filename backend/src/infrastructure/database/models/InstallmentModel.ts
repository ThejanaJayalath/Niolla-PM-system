import mongoose, { Schema, Document } from 'mongoose';
import { Installment } from '../../../domain/entities/Installment';

export interface InstallmentDocument extends Document {
  planId: mongoose.Types.ObjectId;
  installmentNo: number;
  dueDate: Date;
  dueAmount: number;
  paidAmount: number;
  paidDate?: Date;
  partialPaid?: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  overdueDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const installmentSchema = new Schema<InstallmentDocument>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'PaymentPlan', required: true, index: true },
    installmentNo: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    dueAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paidDate: { type: Date },
    partialPaid: { type: Number },
    status: { type: String, enum: ['pending', 'paid', 'partial', 'overdue'], default: 'pending' },
    overdueDays: { type: Number, default: 0 },
  },
  { timestamps: true }
);

installmentSchema.index({ status: 1 });
installmentSchema.index({ dueDate: 1 });

export const InstallmentModel = mongoose.model<InstallmentDocument>('Installment', installmentSchema);
