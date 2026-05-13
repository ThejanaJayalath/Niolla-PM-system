import { Response } from 'express';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { PaymentPlanModel } from '../../infrastructure/database/models/PaymentPlanModel';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { InstallmentModel } from '../../infrastructure/database/models/InstallmentModel';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { CompanyExpenseModel } from '../../infrastructure/database/models/CompanyExpenseModel';
import { InvoiceService } from '../../application/services/InvoiceService';
import { FinanceLedgerService } from '../../application/services/FinanceLedgerService';
import { FinancialReportService } from '../../application/services/FinancialReportService';
import { MasterLedgerService } from '../../application/services/MasterLedgerService';
import { OperationsReportService } from '../../application/services/OperationsReportService';
import type { IncomeInvoiceType } from '../../domain/incomeInvoiceType';
import { AuthenticatedRequest } from '../middleware/auth';

const invoiceService = new InvoiceService();
const financeLedgerService = new FinanceLedgerService();
const financialReportService = new FinancialReportService();
const masterLedgerService = new MasterLedgerService();
const operationsReportService = new OperationsReportService();

function parseReportPeriod(req: AuthenticatedRequest): {
  year?: number;
  month?: number;
  from?: string;
  to?: string;
} {
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const month = req.query.month ? parseInt(String(req.query.month), 10) : undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  return { year, month, from, to };
}

function hasValidReportPeriod(period: ReturnType<typeof parseReportPeriod>): boolean {
  if (period.from && period.to) return true;
  return !!(period.year && period.month && period.month >= 1 && period.month <= 12);
}

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

export interface LiveBusinessBalanceRow {
  key: 'totalRevenue' | 'pendingReceivables' | 'totalExpenses' | 'netProfit' | 'finalProfit';
  category: string;
  description: string;
  amount: number;
}

export interface LiveBusinessBalance {
  rows: LiveBusinessBalanceRow[];
  /** Convenience mirrors for charts / clients */
  totalRevenue: number;
  pendingReceivables: number;
  totalExpenses: number;
  /** @deprecated Use finalProfit */
  netProfit: number;
  finalProfit: number;
  expenseBreakdown: {
    marketing: number;
    payouts: number;
    overheads: number;
  };
}

export async function getFinanceLedger(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const kind = (req.query.kind as string | undefined) || 'all';
    if (kind !== 'all' && kind !== 'income' && kind !== 'expense') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'kind must be all, income, or expense' },
      });
      return;
    }
    const data = await financeLedgerService.getLedger({ from, to, kind: kind as 'all' | 'income' | 'expense' });
    res.json({ success: true, data });
  } catch (err) {
    console.error('Finance ledger error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load finance ledger';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getLiveBusinessBalance(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const snapshot = await masterLedgerService.getBusinessSnapshot();

    const rows: LiveBusinessBalanceRow[] = [
      {
        key: 'totalRevenue',
        category: 'Total Revenue',
        description: 'Paid invoices recorded in the master ledger (self-accounting).',
        amount: snapshot.totalRevenue,
      },
      {
        key: 'pendingReceivables',
        category: 'Pending Receivables',
        description: 'Money still due from installments and unpaid proposal advances.',
        amount: snapshot.pendingReceivables,
      },
      {
        key: 'totalExpenses',
        category: 'Total Expenses',
        description: 'Marketing, developer payouts, and overheads.',
        amount: snapshot.totalExpenses,
      },
      {
        key: 'finalProfit',
        category: 'Final Profit',
        description: 'Revenue minus all expenses — the number admins should trust.',
        amount: snapshot.finalProfit,
      },
    ];

    const data: LiveBusinessBalance = {
      rows,
      totalRevenue: snapshot.totalRevenue,
      pendingReceivables: snapshot.pendingReceivables,
      totalExpenses: snapshot.totalExpenses,
      netProfit: snapshot.finalProfit,
      finalProfit: snapshot.finalProfit,
      expenseBreakdown: snapshot.expenseBreakdown,
    };
    res.json({ success: true, data });
  } catch (err) {
    console.error('Live business balance error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load live business balance';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
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

export async function downloadMonthlyProfitLoss(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    const month = req.query.month ? parseInt(String(req.query.month), 10) : undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    if (!year && !month && !from && !to) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Provide year+month or from+to date range' },
      });
      return;
    }

    const { filename, csv } = await financialReportService.buildMonthlyProfitLossCsv({ year, month, from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export profit/loss report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getProjectFinancialSheet(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await financialReportService.getProjectFinancialSheet(req.params.projectId);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load project financial sheet';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadProjectFinancialSheet(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await financialReportService.buildProjectFinancialSheetCsv(req.params.projectId);
    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send('\uFEFF' + result.csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export project financial sheet';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getFinancialIncomeReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    const data = await financialReportService.getIncomeReport(period);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load income report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getFinancialExpenseReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    const data = await financialReportService.getExpenseReport(period);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load expense report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getFinancialProfitLossReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    if (!hasValidReportPeriod(period)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Provide year+month or from+to date range' },
      });
      return;
    }
    const data = await financialReportService.getProfitLossReport(period);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load profit & loss report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadFinancialIncomeReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    const { filename, csv } = await financialReportService.buildIncomeReportCsv(period);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export income report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadFinancialExpenseReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    const { filename, csv } = await financialReportService.buildExpenseReportCsv(period);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export expense report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getProjectProgressReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await operationsReportService.getProjectProgressReport();
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load project progress report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getStaffPerformanceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await operationsReportService.getStaffPerformanceReport();
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load staff performance report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getMarketingRoiReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const [marketing, pl] = await Promise.all([
      operationsReportService.getMarketingRoiReport({ from, to }),
      financialReportService.getProfitLossReport({ from, to }),
    ]);
    res.json({
      success: true,
      data: {
        ...marketing,
        periodNetProfit: pl.netProfit,
        profitFormula: pl.profitFormula,
        periodIncome: pl.totalIncome,
        marketingVsProfitNote:
          pl.netProfit >= 0
            ? `Marketing spend is ${pl.totalIncome > 0 ? ((marketing.totalMarketingSpend / pl.totalIncome) * 100).toFixed(1) : '—'}% of period income.`
            : 'Period net profit is negative after all expenses.',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load marketing ROI report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadProjectProgressReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { filename, csv } = await operationsReportService.buildProjectProgressCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export project progress report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadStaffPerformanceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { filename, csv } = await operationsReportService.buildStaffPerformanceCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export staff performance report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadMarketingRoiReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const { filename, csv } = await operationsReportService.buildMarketingRoiCsv({ from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export marketing ROI report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getTransactionsReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    const data = await financialReportService.getTransactionsReport(period);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load transactions report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadTransactionsReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    const { filename, csv } = await financialReportService.buildTransactionsReportCsv(period);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export transactions report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getStaffWalletReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    const data = await operationsReportService.getStaffWalletReport(period);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load staff wallet report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadStaffWalletReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const period = parseReportPeriod(req);
    const { filename, csv } = await operationsReportService.buildStaffWalletCsv(period);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export staff wallet report';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getClientStatement(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await financialReportService.getClientStatement(req.params.clientId);
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load client statement';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function downloadClientStatement(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await financialReportService.buildClientStatementCsv(req.params.clientId);
    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send('\uFEFF' + result.csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export client statement';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}
