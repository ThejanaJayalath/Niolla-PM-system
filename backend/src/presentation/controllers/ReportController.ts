import { Response } from 'express';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { PaymentPlanModel } from '../../infrastructure/database/models/PaymentPlanModel';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { InstallmentModel } from '../../infrastructure/database/models/InstallmentModel';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { InvoiceService } from '../../application/services/InvoiceService';
import type { IncomeInvoiceType } from '../../domain/incomeInvoiceType';
import { AuthenticatedRequest } from '../middleware/auth';

const invoiceService = new InvoiceService();

export interface PaymentSummary {
  totalClients: number;
  totalProjectValue: number;
  /** Cash/collected: payment ledger + invoice payments recorded without a payment transaction. */
  totalCollected: number;
  /** Unpaid proposal advance invoices (pending income / A/R). */
  accountsReceivablePending: number;
  pendingBalance: number;
  overdueCount: number;
  dueTodayCount: number;
}

export interface MonthlyCollectionResult {
  year: number;
  month: number;
  totalCollected: number;
  transactionCount: number;
}

export interface OverdueInstallmentRow {
  _id: string;
  planId: string;
  projectName?: string;
  clientName?: string;
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  overdueDays: number;
}

export interface IncomeCategorySummary {
  invoiceType: IncomeInvoiceType;
  label: string;
  description: string;
  totalAmount: number;
  invoiceCount: number;
}

export interface IncomeTrackingRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientName?: string;
  amount: number;
  invoiceType: IncomeInvoiceType;
}

export interface IncomeTrackingResult {
  /** Paid invoices only — realized incoming funds. */
  categories: IncomeCategorySummary[];
  entries: IncomeTrackingRow[];
  grandTotal: number;
}

export async function getPaymentSummary(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const [
      totalClients,
      projectValueResult,
      collectedResult,
      pendingResult,
      overdueCount,
      dueTodayCount,
      arPendingResult,
      invoicePaidStandaloneResult,
    ] = await Promise.all([
      CustomerModel.countDocuments(),
      ProjectModel.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$totalValue' } } }]),
      PaymentTransactionModel.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      PaymentPlanModel.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$remainingBalance' } } }]),
      InstallmentModel.countDocuments({ status: 'overdue' }),
      (() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return InstallmentModel.countDocuments({
          status: { $in: ['pending', 'partial'] },
          dueDate: { $gte: start, $lt: end },
        });
      })(),
      InvoiceModel.aggregate<{ total: number }>([
        {
          $match: {
            status: { $in: ['pending', 'sent', 'draft'] },
            sourceType: 'PROPOSAL_ADVANCE',
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      InvoiceModel.aggregate<{ total: number }>([
        {
          $match: {
            status: 'paid',
            $or: [{ transactionId: { $exists: false } }, { transactionId: null }],
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const txCollected = collectedResult[0]?.total ?? 0;
    const invoiceCollected = invoicePaidStandaloneResult[0]?.total ?? 0;

    const summary: PaymentSummary = {
      totalClients,
      totalProjectValue: projectValueResult[0]?.total ?? 0,
      totalCollected: txCollected + invoiceCollected,
      accountsReceivablePending: arPendingResult[0]?.total ?? 0,
      pendingBalance: pendingResult[0]?.total ?? 0,
      overdueCount,
      dueTodayCount,
    };
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Report summary error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load summary';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getMonthlyCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);
    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'year and month (1-12) are required' } });
      return;
    }
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const [agg] = await PaymentTransactionModel.aggregate<{ total: number; count: number }>([
      { $match: { paymentDate: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const data: MonthlyCollectionResult = {
      year,
      month,
      totalCollected: agg?.total ?? 0,
      transactionCount: agg?.count ?? 0,
    };
    res.json({ success: true, data });
  } catch (err) {
    console.error('Monthly collection error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load monthly collection';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getOverdueList(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const docs = await InstallmentModel.find({ status: 'overdue' })
      .populate({ path: 'planId', select: 'projectId', populate: { path: 'projectId', select: 'projectName clientId', populate: { path: 'clientId', select: 'name companyName' } } })
      .sort({ dueDate: 1 })
      .lean();
    const rows: OverdueInstallmentRow[] = docs.map((d: Record<string, unknown>) => {
      const plan = d.planId as { projectId?: { projectName?: string; clientId?: { name?: string; companyName?: string } } } | null;
      let projectName: string | undefined;
      let clientName: string | undefined;
      if (plan?.projectId && typeof plan.projectId === 'object') {
        projectName = (plan.projectId as { projectName?: string }).projectName;
        const client = (plan.projectId as { clientId?: { name?: string; companyName?: string } }).clientId;
        if (client) clientName = (client.companyName as string) || (client.name as string);
      }
      return {
        _id: (d._id as { toString: () => string }).toString(),
        planId: (d.planId as { _id?: { toString: () => string } })?._id?.toString() ?? '',
        projectName,
        clientName,
        installmentNo: d.installmentNo as number,
        dueDate: (d.dueDate as Date).toISOString(),
        dueAmount: d.dueAmount as number,
        paidAmount: (d.paidAmount as number) ?? 0,
        overdueDays: (d.overdueDays as number) ?? 0,
      };
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Overdue list error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load overdue list';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

const INCOME_CATEGORY_META: Record<
  IncomeInvoiceType,
  { label: string; description: string }
> = {
  ADVANCE_PAYMENT: {
    label: 'Advance Payments',
    description:
      'A 40% upfront payment received immediately after the proposal is confirmed.',
  },
  MONTHLY_INSTALLMENT: {
    label: 'Monthly Installments',
    description: 'Recurring monthly payments collected from customers opted into an installment plan.',
  },
  BALANCE_PAYMENT: {
    label: 'Balance Payments',
    description: 'The remaining final settlement received upon the successful completion of a project.',
  },
};

/**
 * Income tracking: categorize paid invoice amounts by invoice type (advance / installment / balance).
 */
export async function getIncomeTracking(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const invoices = await invoiceService.paidInvoicesForIncomeTracking();

    const buckets: Record<IncomeInvoiceType, { total: number; count: number }> = {
      ADVANCE_PAYMENT: { total: 0, count: 0 },
      MONTHLY_INSTALLMENT: { total: 0, count: 0 },
      BALANCE_PAYMENT: { total: 0, count: 0 },
    };

    const entries: IncomeTrackingRow[] = [];
    let grandTotal = 0;

    for (const inv of invoices) {
      const amt = Number(inv.totalAmount) || 0;
      const invoiceType: IncomeInvoiceType =
        inv.invoiceType === 'ADVANCE_PAYMENT' ||
        inv.invoiceType === 'MONTHLY_INSTALLMENT' ||
        inv.invoiceType === 'BALANCE_PAYMENT'
          ? inv.invoiceType
          : inv.sourceType === 'PROPOSAL_ADVANCE'
            ? 'ADVANCE_PAYMENT'
            : 'MONTHLY_INSTALLMENT';

      buckets[invoiceType].total += amt;
      buckets[invoiceType].count += 1;
      grandTotal += amt;

      entries.push({
        invoiceId: inv._id || '',
        invoiceNumber: inv.invoiceNumber,
        invoiceDate:
          inv.invoiceDate instanceof Date ? inv.invoiceDate.toISOString() : new Date(inv.invoiceDate).toISOString(),
        clientName: inv.clientName,
        amount: amt,
        invoiceType,
      });
    }

    const categories: IncomeCategorySummary[] = (Object.keys(buckets) as IncomeInvoiceType[]).map((invoiceType) => ({
      invoiceType,
      label: INCOME_CATEGORY_META[invoiceType].label,
      description: INCOME_CATEGORY_META[invoiceType].description,
      totalAmount: buckets[invoiceType].total,
      invoiceCount: buckets[invoiceType].count,
    }));

    const data: IncomeTrackingResult = { categories, entries, grandTotal };
    res.json({ success: true, data });
  } catch (err) {
    console.error('Income tracking error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load income tracking';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}
