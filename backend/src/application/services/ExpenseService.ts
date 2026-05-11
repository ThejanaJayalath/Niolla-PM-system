import mongoose from 'mongoose';
import { CompanyExpenseModel, CompanyExpenseCategory, CompanyExpenseSource } from '../../infrastructure/database/models/CompanyExpenseModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';

export interface CompanyExpenseRow {
  _id: string;
  amount: number;
  category: CompanyExpenseCategory;
  description: string;
  expenseDate: string;
  source: CompanyExpenseSource;
  developerId?: string;
  projectId?: string;
  automationKind?: 'PAYOUT_APPROVAL';
  recordedBy: string;
  createdAt?: string;
}

export interface ExpenseSummaryByCategory {
  category: CompanyExpenseCategory;
  label: string;
  description: string;
  totalAmount: number;
  entryCount: number;
}

export interface CreateManualExpenseInput {
  category: CompanyExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  recordedByUserId: string;
}

const CATEGORY_META: Record<CompanyExpenseCategory, { label: string; description: string }> = {
  MARKETING: {
    label: 'Marketing expenses',
    description: 'Costs associated with digital advertising, including Facebook Ads and Google Ads campaigns.',
  },
  STAFF_SALARIES: {
    label: 'Staff salaries',
    description: 'Core monthly salaries and payments linked directly to Developer Wallets.',
  },
  OPERATIONAL: {
    label: 'Operational costs',
    description: 'Essential overheads such as server fees (infrastructure), office rent, and utility bills.',
  },
};

export class ExpenseService {
  async createManual(input: CreateManualExpenseInput): Promise<CompanyExpenseRow> {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number');
    const uid = input.recordedByUserId.trim();
    if (!uid || !mongoose.Types.ObjectId.isValid(uid)) throw new Error('Invalid recorder');
    const desc = input.description?.trim();
    if (!desc) throw new Error('Description is required');
    if (!['MARKETING', 'STAFF_SALARIES', 'OPERATIONAL'].includes(input.category)) {
      throw new Error('Invalid expense category');
    }
    const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();
    if (Number.isNaN(expenseDate.getTime())) throw new Error('Invalid expense date');

    const doc = await CompanyExpenseModel.create({
      amount,
      category: input.category,
      description: desc,
      expenseDate,
      source: 'manual' as CompanyExpenseSource,
      recordedBy: new mongoose.Types.ObjectId(uid),
    });
    return this.toRow(doc);
  }

  /**
   * Automated log when an owner approves a developer payout (credits wallet).
   */
  async logAutomatedStaffSalaryFromPayoutApproval(args: {
    amount: number;
    developerId: string;
    projectId: string;
    projectName: string;
    recordedByUserId: string;
  }): Promise<void> {
    const amount = Number(args.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const dev = await UserModel.findById(args.developerId).select('name').lean();
    const devName = (dev?.name as string)?.trim() || 'Developer';
    const desc = `Developer wallet credit — payout approved: ${args.projectName} (${devName})`;
    await CompanyExpenseModel.create({
      amount,
      category: 'STAFF_SALARIES',
      description: desc,
      expenseDate: new Date(),
      source: 'automated',
      developerId: new mongoose.Types.ObjectId(args.developerId),
      projectId: new mongoose.Types.ObjectId(args.projectId),
      automationKind: 'PAYOUT_APPROVAL',
      recordedBy: new mongoose.Types.ObjectId(args.recordedByUserId),
    });
  }

  async list(limit = 200): Promise<CompanyExpenseRow[]> {
    const docs = await CompanyExpenseModel.find()
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(Math.min(500, Math.max(1, limit)))
      .lean();
    return docs.map((d) => this.leanToRow(d));
  }

  async summary(): Promise<ExpenseSummaryByCategory[]> {
    const agg = await CompanyExpenseModel.aggregate<{ _id: CompanyExpenseCategory; t: number; c: number }>([
      { $group: { _id: '$category', t: { $sum: '$amount' }, c: { $sum: 1 } } },
    ]);
    const byCat = Object.fromEntries(agg.map((a) => [a._id, { total: a.t, count: a.c }])) as Record<
      CompanyExpenseCategory,
      { total: number; count: number }
    >;
    const keys: CompanyExpenseCategory[] = ['MARKETING', 'STAFF_SALARIES', 'OPERATIONAL'];
    return keys.map((category) => {
      const m = CATEGORY_META[category];
      const row = byCat[category];
      return {
        category,
        label: m.label,
        description: m.description,
        totalAmount: row?.total ?? 0,
        entryCount: row?.count ?? 0,
      };
    });
  }

  private toRow(doc: { toObject: () => Record<string, unknown>; _id: unknown }): CompanyExpenseRow {
    return this.leanToRow(doc.toObject() as Record<string, unknown>);
  }

  private leanToRow(o: Record<string, unknown>): CompanyExpenseRow {
    const id = o._id as { toString: () => string };
    return {
      _id: id && typeof id.toString === 'function' ? id.toString() : String(o._id),
      amount: Number(o.amount) || 0,
      category: o.category as CompanyExpenseCategory,
      description: String(o.description || ''),
      expenseDate: (o.expenseDate as Date).toISOString(),
      source: o.source as CompanyExpenseSource,
      developerId: o.developerId ? String(o.developerId) : undefined,
      projectId: o.projectId ? String(o.projectId) : undefined,
      automationKind: o.automationKind as 'PAYOUT_APPROVAL' | undefined,
      recordedBy: String(o.recordedBy),
      createdAt: o.createdAt ? new Date(o.createdAt as Date).toISOString() : undefined,
    };
  }
}
