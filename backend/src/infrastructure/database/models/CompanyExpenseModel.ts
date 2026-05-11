import mongoose, { Schema, Document } from 'mongoose';

export type CompanyExpenseCategory = 'MARKETING' | 'STAFF_SALARIES' | 'OPERATIONAL';
export type CompanyExpenseSource = 'manual' | 'automated';

export interface CompanyExpenseDocument extends Document {
  amount: number;
  category: CompanyExpenseCategory;
  description: string;
  expenseDate: Date;
  source: CompanyExpenseSource;
  /** When category is STAFF_SALARIES from wallet payout approval. */
  developerId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  automationKind?: 'PAYOUT_APPROVAL';
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companyExpenseSchema = new Schema<CompanyExpenseDocument>(
  {
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['MARKETING', 'STAFF_SALARIES', 'OPERATIONAL'],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true },
    expenseDate: { type: Date, required: true, index: true },
    source: { type: String, enum: ['manual', 'automated'], required: true, index: true },
    developerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    automationKind: { type: String, enum: ['PAYOUT_APPROVAL'] },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

companyExpenseSchema.index({ expenseDate: -1, category: 1 });

export const CompanyExpenseModel = mongoose.model<CompanyExpenseDocument>('CompanyExpense', companyExpenseSchema);
