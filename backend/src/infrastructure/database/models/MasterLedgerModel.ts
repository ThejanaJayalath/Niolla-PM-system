import mongoose, { Schema, Document } from 'mongoose';

export type MasterLedgerKind = 'income' | 'expense';

export type MasterLedgerSource =
  | 'INVOICE_PAID'
  | 'PAYOUT_ASSIGNED'
  | 'COMPANY_EXPENSE'
  | 'SYSTEM_REBUILD';

export interface MasterLedgerDocument extends Document {
  kind: MasterLedgerKind;
  source: MasterLedgerSource;
  category: string;
  amount: number;
  description: string;
  occurredAt: Date;
  /** Idempotency key — one row per business event. */
  uniqueKey: string;
  invoiceId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  developerId?: mongoose.Types.ObjectId;
  expenseId?: mongoose.Types.ObjectId;
  clientName?: string;
  invoiceNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const masterLedgerSchema = new Schema<MasterLedgerDocument>(
  {
    kind: { type: String, enum: ['income', 'expense'], required: true, index: true },
    source: {
      type: String,
      enum: ['INVOICE_PAID', 'PAYOUT_ASSIGNED', 'COMPANY_EXPENSE', 'SYSTEM_REBUILD'],
      required: true,
      index: true,
    },
    category: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    occurredAt: { type: Date, required: true, index: true },
    uniqueKey: { type: String, required: true, unique: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    developerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    expenseId: { type: Schema.Types.ObjectId, ref: 'CompanyExpense', index: true },
    clientName: { type: String },
    invoiceNumber: { type: String },
  },
  { timestamps: true }
);

masterLedgerSchema.index({ occurredAt: -1, kind: 1 });

export const MasterLedgerModel = mongoose.model<MasterLedgerDocument>('MasterLedger', masterLedgerSchema);
