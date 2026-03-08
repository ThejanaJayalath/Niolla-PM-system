import mongoose, { Schema, Document } from 'mongoose';
import { PaymentTransaction } from '../../../domain/entities/PaymentTransaction';

export interface PaymentTransactionDocument extends Document {
  installmentId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  gatewayId?: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'card' | 'online';
  referenceNo?: string;
  paymentDate: Date;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentTransactionSchema = new Schema<PaymentTransactionDocument>(
  {
    installmentId: { type: Schema.Types.ObjectId, ref: 'Installment', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    gatewayId: { type: Schema.Types.ObjectId },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank', 'card', 'online'],
      required: true,
    },
    referenceNo: { type: String, sparse: true, unique: true },
    paymentDate: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ paymentDate: -1 });
paymentTransactionSchema.index({ clientId: 1, paymentDate: -1 });

export const PaymentTransactionModel = mongoose.model<PaymentTransactionDocument>(
  'PaymentTransaction',
  paymentTransactionSchema
);
