import mongoose from 'mongoose';
import { MasterLedgerModel } from '../../infrastructure/database/models/MasterLedgerModel';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { CompanyExpenseModel } from '../../infrastructure/database/models/CompanyExpenseModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import type { FinanceLedgerResult, FinanceLedgerRow } from './FinanceLedgerService';

export interface MasterBusinessSnapshot {
  totalRevenue: number;
  pendingReceivables: number;
  totalExpenses: number;
  finalProfit: number;
  expenseBreakdown: {
    marketing: number;
    payouts: number;
    overheads: number;
  };
}

const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  MARKETING: 'Marketing',
  STAFF_SALARIES: 'Payouts',
  INFRASTRUCTURE: 'Overheads',
  OPERATIONAL: 'Overheads',
};

function parseRange(from?: string, to?: string): { start?: Date; end?: Date } {
  let start: Date | undefined;
  let end: Date | undefined;
  if (from?.trim()) {
    start = new Date(from.trim());
    if (Number.isNaN(start.getTime())) start = undefined;
    else start.setHours(0, 0, 0, 0);
  }
  if (to?.trim()) {
    end = new Date(to.trim());
    if (Number.isNaN(end.getTime())) end = undefined;
    else end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

export class MasterLedgerService {
  /**
   * Record income when an invoice becomes paid (idempotent per invoice).
   */
  async recordInvoicePaid(invoiceId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) return;
    const inv = await InvoiceModel.findById(invoiceId).populate('clientId', 'name companyName').lean();
    if (!inv || inv.status !== 'paid') return;

    const amount = Number(inv.totalAmount) || 0;
    if (amount <= 0) return;

    const client = inv.clientId as { name?: string; companyName?: string } | null;
    const clientName = client ? (client.companyName as string) || (client.name as string) : undefined;

    await MasterLedgerModel.findOneAndUpdate(
      { uniqueKey: `income:invoice:${invoiceId}` },
      {
        $set: {
          kind: 'income',
          source: 'INVOICE_PAID',
          category: 'Income',
          amount,
          description: inv.description?.trim() || `Paid invoice ${inv.invoiceNumber}`,
          occurredAt: inv.invoiceDate ? new Date(inv.invoiceDate) : new Date(),
          invoiceId: new mongoose.Types.ObjectId(invoiceId),
          clientName,
          invoiceNumber: inv.invoiceNumber,
        },
      },
      { upsert: true }
    );
  }

  /**
   * Remove income row if invoice is no longer paid.
   */
  async removeInvoiceIncome(invoiceId: string): Promise<void> {
    await MasterLedgerModel.deleteOne({ uniqueKey: `income:invoice:${invoiceId}` });
  }

  /**
   * Sync all developer payout allocations for a project into the master ledger.
   */
  async syncProjectPayoutAccruals(projectId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) return;
    const project = await ProjectModel.findById(projectId)
      .select('projectName assignedEmployeePayouts assignedEmployees')
      .lean();
    if (!project) return;

    const payouts = project.assignedEmployeePayouts as Record<string, number> | Map<string, number> | undefined;
    const payoutRecord: Record<string, number> = {};
    if (payouts instanceof Map) {
      payouts.forEach((v, k) => {
        payoutRecord[String(k)] = Number(v);
      });
    } else if (payouts && typeof payouts === 'object') {
      for (const [k, v] of Object.entries(payouts)) payoutRecord[k] = Number(v);
    }

    const activeKeys = new Set<string>();
    const devIds = Object.keys(payoutRecord).filter((id) => Number(payoutRecord[id]) > 0);
    const devs =
      devIds.length > 0
        ? await UserModel.find({ _id: { $in: devIds } })
            .select('name')
            .lean()
        : [];

    const devName: Record<string, string> = {};
    for (const d of devs) devName[String(d._id)] = (d.name as string) || 'Developer';

    for (const developerId of devIds) {
      const amount = Number(payoutRecord[developerId]) || 0;
      if (amount <= 0) continue;
      const uniqueKey = `expense:payout:${projectId}:${developerId}`;
      activeKeys.add(uniqueKey);
      const name = devName[developerId] || 'Developer';
      await MasterLedgerModel.findOneAndUpdate(
        { uniqueKey },
        {
          $set: {
            kind: 'expense',
            source: 'PAYOUT_ASSIGNED',
            category: 'Payouts',
            amount,
            description: `Developer payout allocated — ${project.projectName} (${name})`,
            occurredAt: new Date(),
            projectId: new mongoose.Types.ObjectId(projectId),
            developerId: new mongoose.Types.ObjectId(developerId),
          },
        },
        { upsert: true }
      );
    }

    await MasterLedgerModel.deleteMany({
      source: 'PAYOUT_ASSIGNED',
      projectId: new mongoose.Types.ObjectId(projectId),
      uniqueKey: { $nin: [...activeKeys] },
    });
  }

  /**
   * Mirror a company expense into the master ledger (skips monthly payroll to avoid double-counting salaries).
   */
  async recordCompanyExpense(expenseId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(expenseId)) return;
    const ex = await CompanyExpenseModel.findById(expenseId).lean();
    if (!ex) return;

    if (ex.automationKind === 'MONTHLY_PAYROLL') {
      return;
    }

    const rawCat = String(ex.category || '');
    const cat = rawCat === 'OPERATIONAL' ? 'INFRASTRUCTURE' : rawCat;
    const label = EXPENSE_CATEGORY_LABEL[cat] || cat;
    const amount = Number(ex.amount) || 0;
    if (amount <= 0) return;

    await MasterLedgerModel.findOneAndUpdate(
      { uniqueKey: `expense:company:${expenseId}` },
      {
        $set: {
          kind: 'expense',
          source: 'COMPANY_EXPENSE',
          category: label,
          amount,
          description: String(ex.description || label),
          occurredAt: ex.expenseDate ? new Date(ex.expenseDate) : new Date(),
          expenseId: new mongoose.Types.ObjectId(expenseId),
          ...(ex.projectId ? { projectId: ex.projectId } : {}),
          ...(ex.developerId ? { developerId: ex.developerId } : {}),
        },
      },
      { upsert: true }
    );
  }

  async removeCompanyExpense(expenseId: string): Promise<void> {
    await MasterLedgerModel.deleteOne({ uniqueKey: `expense:company:${expenseId}` });
  }

  /** One-time sync from existing invoices, expenses, and project payouts. */
  async rebuildFromSources(): Promise<void> {
    const paidInvoices = await InvoiceModel.find({ status: 'paid' }).select('_id').lean();
    for (const inv of paidInvoices) {
      await this.recordInvoicePaid(String(inv._id));
    }

    const expenses = await CompanyExpenseModel.find({}).select('_id').lean();
    for (const ex of expenses) {
      await this.recordCompanyExpense(String(ex._id));
    }

    const projects = await ProjectModel.find({}).select('_id').lean();
    for (const p of projects) {
      await this.syncProjectPayoutAccruals(String(p._id));
    }
  }

  private async ensureSeeded(): Promise<void> {
    const count = await MasterLedgerModel.estimatedDocumentCount();
    if (count === 0) {
      await this.rebuildFromSources();
    }
  }

  async getLedger(filters?: {
    from?: string;
    to?: string;
    kind?: 'all' | 'income' | 'expense';
  }): Promise<FinanceLedgerResult> {
    await this.ensureSeeded();
    const { start, end } = parseRange(filters?.from, filters?.to);
    const kindFilter = filters?.kind ?? 'all';

    const query: Record<string, unknown> = {};
    if (kindFilter !== 'all') query.kind = kindFilter;
    if (start || end) {
      const range: Record<string, Date> = {};
      if (start) range.$gte = start;
      if (end) range.$lte = end;
      query.occurredAt = range;
    }

    const docs = await MasterLedgerModel.find(query).sort({ occurredAt: -1 }).lean();
    const rows: FinanceLedgerRow[] = docs.map((doc) => ({
      _id: String(doc._id),
      kind: doc.kind as 'income' | 'expense',
      date: new Date(doc.occurredAt).toISOString(),
      amount: Number(doc.amount) || 0,
      description: String(doc.description || ''),
      categoryLabel:
        doc.kind === 'income'
          ? 'Income · Invoice'
          : `Expense · ${doc.category || 'General'}`,
      referenceId: doc.invoiceId
        ? String(doc.invoiceId)
        : doc.expenseId
          ? String(doc.expenseId)
          : doc.projectId
            ? String(doc.projectId)
            : String(doc._id),
      referenceType: doc.kind === 'income' ? 'invoice' : 'expense',
      clientName: doc.clientName,
      invoiceNumber: doc.invoiceNumber,
      expenseCategory: doc.kind === 'expense' ? doc.category : undefined,
      expenseSource: doc.source === 'PAYOUT_ASSIGNED' ? 'automated' : doc.source === 'COMPANY_EXPENSE' ? 'manual' : undefined,
    }));

    const sumIncome = rows.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount, 0);
    const sumExpense = rows.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0);

    return {
      rows,
      sumIncome,
      sumExpense,
      currentBalance: sumIncome - sumExpense,
      from: start?.toISOString(),
      to: end?.toISOString(),
    };
  }

  async getBusinessSnapshot(): Promise<MasterBusinessSnapshot> {
    await this.ensureSeeded();

    const { InstallmentModel } = await import('../../infrastructure/database/models/InstallmentModel');

    const [incomeAgg, expenseAgg, expenseByCat, installmentReceivable, arPending] = await Promise.all([
      MasterLedgerModel.aggregate<{ total: number }>([
        { $match: { kind: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      MasterLedgerModel.aggregate<{ total: number }>([
        { $match: { kind: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      MasterLedgerModel.aggregate<{ _id: string; total: number }>([
        { $match: { kind: 'expense' } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
      ]),
      InstallmentModel.aggregate<{ total: number }>([
        { $match: { status: { $in: ['pending', 'partial', 'overdue'] } } },
        {
          $group: {
            _id: null,
            total: { $sum: { $subtract: ['$dueAmount', { $ifNull: ['$paidAmount', 0] }] } },
          },
        },
      ]),
      InvoiceModel.aggregate<{ total: number }>([
        {
          $match: {
            status: { $in: ['pending', 'sent', 'draft'] },
            sourceType: 'PROPOSAL_ADVANCE',
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const totalRevenue = incomeAgg[0]?.total ?? 0;
    const totalExpenses = expenseAgg[0]?.total ?? 0;
    const finalProfit = totalRevenue - totalExpenses;

    const catMap: Record<string, number> = {};
    for (const row of expenseByCat) {
      catMap[row._id] = row.total;
    }

    return {
      totalRevenue,
      pendingReceivables: (installmentReceivable[0]?.total ?? 0) + (arPending[0]?.total ?? 0),
      totalExpenses,
      finalProfit,
      expenseBreakdown: {
        marketing: catMap.Marketing ?? 0,
        payouts: (catMap.Payouts ?? 0) + (catMap.Salaries ?? 0),
        overheads: (catMap.Overheads ?? 0) + (catMap.Infrastructure ?? 0),
      },
    };
  }
}
