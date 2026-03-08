import mongoose, { Schema, Document } from 'mongoose';
import { PaymentPlan } from '../../../domain/entities/PaymentPlan';

export interface PaymentPlanDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  downPaymentPct: number;
  downPaymentAmt: number;
  totalInstallments: number;
  installmentAmt: number;
  remainingBalance: number;
  planStartDate?: Date;
  status: 'active' | 'completed' | 'defaulted';
  createdAt: Date;
  updatedAt: Date;
}

const paymentPlanSchema = new Schema<PaymentPlanDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    downPaymentPct: { type: Number, required: true },
    downPaymentAmt: { type: Number, required: true },
    totalInstallments: { type: Number, required: true },
    installmentAmt: { type: Number, required: true },
    remainingBalance: { type: Number, required: true },
    planStartDate: { type: Date },
    status: { type: String, enum: ['active', 'completed', 'defaulted'], default: 'active' },
  },
  { timestamps: true }
);

paymentPlanSchema.index({ status: 1 });

export const PaymentPlanModel = mongoose.model<PaymentPlanDocument>('PaymentPlan', paymentPlanSchema);
