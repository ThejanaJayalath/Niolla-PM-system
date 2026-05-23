import mongoose, { Schema, Document } from 'mongoose';

export type CompanyExpenseCategory = 'MARKETING' | 'STAFF_SALARIES' | 'INFRASTRUCTURE';
/** @deprecated stored as INFRASTRUCTURE — kept for reads of legacy rows */
export type LegacyExpenseCategory = 'OPERATIONAL';
export type CompanyExpenseSource = 'manual' | 'automated';
export type CompanyExpenseAutomationKind = 'PAYOUT_APPROVAL' | 'PROJECT_OVERHEAD' | 'MONTHLY_PAYROLL';

export interface CompanyExpenseDocument extends Document {
  amount: number;
  category: CompanyExpenseCategory;
  description: string;
  expenseDate: Date;
  source: CompanyExpenseSource;
  /** When category is STAFF_SALARIES from wallet payout approval. */
  developerId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  automationKind?: CompanyExpenseAutomationKind;
  payrollPeriod?: string;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companyExpenseSchema = new Schema<CompanyExpenseDocument>(
  {
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['MARKETING', 'STAFF_SALARIES', 'INFRASTRUCTURE', 'OPERATIONAL'],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true },
    expenseDate: { type: Date, required: true, index: true },
    source: { type: String, enum: ['manual', 'automated'], required: true, index: true },
    developerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    automationKind: { type: String, enum: ['PAYOUT_APPROVAL', 'PROJECT_OVERHEAD', 'MONTHLY_PAYROLL'] },
    payrollPeriod: { type: String, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

companyExpenseSchema.index({ expenseDate: -1, category: 1 });
companyExpenseSchema.index({ developerId: 1, payrollPeriod: 1, automationKind: 1 });

export const CompanyExpenseModel = mongoose.model<CompanyExpenseDocument>('CompanyExpense', companyExpenseSchema);
