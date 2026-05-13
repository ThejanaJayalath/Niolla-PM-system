import mongoose from 'mongoose';
import type { IncomeInvoiceType } from '../../domain/incomeInvoiceType';
import { FinanceLedgerService } from './FinanceLedgerService';
import { MasterLedgerService } from './MasterLedgerService';
import { InvoiceService } from './InvoiceService';
import { ProjectService } from './ProjectService';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { PaymentPlanModel } from '../../infrastructure/database/models/PaymentPlanModel';
import { InstallmentModel } from '../../infrastructure/database/models/InstallmentModel';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { CompanyExpenseModel } from '../../infrastructure/database/models/CompanyExpenseModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { calcNetProfit, expenseBucketFromCategory, PROFIT_FORMULA_LABEL } from '../../domain/reportProfit';

const financeLedgerService = new FinanceLedgerService();
const masterLedgerService = new MasterLedgerService();
const invoiceService = new InvoiceService();
const projectService = new ProjectService();

const INCOME_CATEGORY_META: Record<
  IncomeInvoiceType,
  { label: string; description: string }
> = {
  ADVANCE_PAYMENT: {
    label: 'Advance payments',
    description: 'Upfront payments received after proposal confirmation.',
  },
  MONTHLY_INSTALLMENT: {
    label: 'Monthly installments',
    description: 'Recurring installment collections from payment plans.',
  },
  BALANCE_PAYMENT: {
    label: 'Remaining / balance payments',
    description: 'Final settlement upon project completion.',
  },
};

export interface IncomeReportEntry {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientName?: string;
  amount: number;
  invoiceType: IncomeInvoiceType;
  typeLabel: string;
}

export interface IncomeReportResult {
  period: string;
  year?: number;
  month?: number;
  categories: {
    invoiceType: IncomeInvoiceType;
    label: string;
    description: string;
    totalAmount: number;
    invoiceCount: number;
  }[];
  entries: IncomeReportEntry[];
  totalIncome: number;
}

export interface ExpenseReportEntry {
  date: string;
  category: string;
  description: string;
  amount: number;
  source: string;
}

export interface ExpenseReportResult {
  period: string;
  year?: number;
  month?: number;
  categories: {
    key: 'marketing' | 'payouts' | 'overheads';
    label: string;
    description: string;
    totalAmount: number;
    entryCount: number;
  }[];
  entries: ExpenseReportEntry[];
  totalExpenses: number;
}

export interface ProfitLossReportResult {
  period: string;
  year?: number;
  month?: number;
  from?: string;
  to?: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitFormula: string;
  incomeByType: IncomeReportResult['categories'];
  expenseBreakdown: {
    marketing: number;
    payouts: number;
    overheads: number;
  };
  ledgerRows: Awaited<ReturnType<FinanceLedgerService['getLedger']>>['rows'];
}

export interface TransactionsReportEntry {
  date: string;
  kind: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  clientName?: string;
  invoiceNumber?: string;
  referenceId: string;
}

export interface TransactionsReportResult {
  period: string;
  sourceTable: 'Transactions';
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  expenseBreakdown: {
    marketing: number;
    payouts: number;
    overheads: number;
  };
  netProfit: number;
  profitFormula: string;
  entries: TransactionsReportEntry[];
}

export interface ReportPeriodParams {
  year?: number;
  month?: number;
  from?: string;
  to?: string;
}

function resolvePeriod(params?: ReportPeriodParams): {
  from?: string;
  to?: string;
  period: string;
  year?: number;
  month?: number;
} {
  if (params?.from && params?.to) {
    const start = new Date(params.from);
    const end = new Date(params.to);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return {
        from: start.toISOString(),
        to: end.toISOString(),
        period: `${formatReportDate(start.toISOString())} – ${formatReportDate(end.toISOString())}`,
      };
    }
  }
  if (params?.year && params?.month) {
    const r = monthRangeIso(params.year, params.month);
    return { from: r.from, to: r.to, period: r.label, year: params.year, month: params.month };
  }
  return { period: 'all-time' };
}

function expenseBucket(category: string): 'marketing' | 'payouts' | 'overheads' {
  return expenseBucketFromCategory(category);
}

export interface ProjectFinancialSheet {
  projectId: string;
  projectName: string;
  clientName?: string;
  status: string;
  sourceTable: 'Projects';
  contractValue: number;
  collectedPayments: number;
  paidInvoices: number;
  totalRevenue: number;
  infrastructureOverhead: number;
  developerPayouts: number;
  developerPayoutsPaid: number;
  developerPayoutsPending: number;
  linkedExpenses: number;
  totalCosts: number;
  contractNetProfit: number;
  cashNetProfit: number;
  paymentRows: { date: string; amount: number; method: string; reference?: string }[];
  invoiceRows: { date: string; invoiceNumber: string; amount: number; status: string }[];
  expenseRows: { date: string; category: string; description: string; amount: number; source: string }[];
  developerPayoutRows: { developerName: string; amount: number; releaseStatus: string }[];
}

export interface ClientStatementProjectRow {
  projectId: string;
  projectName: string;
  contractValue: number;
  collected: number;
  remainingBalance: number;
  status: string;
}

export interface ClientStatement {
  clientId: string;
  clientName: string;
  email?: string;
  phoneNumber?: string;
  sourceTable: 'Clients';
  totalContractValue: number;
  totalPaid: number;
  totalRemainingBalance: number;
  projects: ClientStatementProjectRow[];
  paymentRows: { date: string; amount: number; method: string; reference?: string }[];
  invoiceRows: { date: string; invoiceNumber: string; amount: number; status: string; projectName?: string }[];
  installmentRows: {
    projectName: string;
    installmentNo: number;
    dueDate: string;
    dueAmount: number;
    paidAmount: number;
    status: string;
  }[];
}

function escapeCsv(val: string | number | undefined | null): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells: (string | number | undefined | null)[]): string {
  return cells.map(escapeCsv).join(',');
}

function monthRangeIso(year: number, month: number): { from: string; to: string; label: string } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  const label = `${year}-${String(month).padStart(2, '0')}`;
  return { from: start.toISOString(), to: end.toISOString(), label };
}

function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export class FinancialReportService {
  async getIncomeReport(period?: ReportPeriodParams): Promise<IncomeReportResult> {
    const periodInfo = resolvePeriod(period);
    let invoices = await invoiceService.paidInvoicesForIncomeTracking();

    if (periodInfo.from && periodInfo.to) {
      const start = new Date(periodInfo.from).getTime();
      const end = new Date(periodInfo.to).getTime();
      invoices = invoices.filter((inv) => {
        const t = new Date(inv.invoiceDate).getTime();
        return t >= start && t <= end;
      });
    }

    const buckets: Record<IncomeInvoiceType, { total: number; count: number }> = {
      ADVANCE_PAYMENT: { total: 0, count: 0 },
      MONTHLY_INSTALLMENT: { total: 0, count: 0 },
      BALANCE_PAYMENT: { total: 0, count: 0 },
    };

    const entries: IncomeReportEntry[] = [];
    let totalIncome = 0;

    for (const inv of invoices) {
      const amt = Number(inv.totalAmount) || 0;
      let invoiceType: IncomeInvoiceType = inv.invoiceType || 'MONTHLY_INSTALLMENT';
      if (!inv.invoiceType) {
        invoiceType =
          inv.sourceType === 'PROPOSAL_ADVANCE' ? 'ADVANCE_PAYMENT' : 'MONTHLY_INSTALLMENT';
      }
      buckets[invoiceType].total += amt;
      buckets[invoiceType].count += 1;
      totalIncome += amt;
      entries.push({
        invoiceId: inv._id || '',
        invoiceNumber: inv.invoiceNumber,
        invoiceDate:
          inv.invoiceDate instanceof Date
            ? inv.invoiceDate.toISOString()
            : new Date(inv.invoiceDate).toISOString(),
        clientName: inv.clientName,
        amount: amt,
        invoiceType,
        typeLabel: INCOME_CATEGORY_META[invoiceType].label,
      });
    }

    const categories = (Object.keys(buckets) as IncomeInvoiceType[]).map((invoiceType) => ({
      invoiceType,
      label: INCOME_CATEGORY_META[invoiceType].label,
      description: INCOME_CATEGORY_META[invoiceType].description,
      totalAmount: buckets[invoiceType].total,
      invoiceCount: buckets[invoiceType].count,
    }));

    return {
      period: periodInfo.period,
      year: periodInfo.year,
      month: periodInfo.month,
      categories,
      entries,
      totalIncome,
    };
  }

  async getExpenseReport(period?: ReportPeriodParams): Promise<ExpenseReportResult> {
    const periodInfo = resolvePeriod(period);
    const ledger = await masterLedgerService.getLedger({
      from: periodInfo.from,
      to: periodInfo.to,
      kind: 'expense',
    });

    const bucketTotals = { marketing: 0, payouts: 0, overheads: 0 };
    const bucketCounts = { marketing: 0, payouts: 0, overheads: 0 };

    const entries: ExpenseReportEntry[] = ledger.rows.map((row) => {
      const catLabel = row.expenseCategory || row.categoryLabel.replace(/^Expense · /, '');
      const bucket = expenseBucket(catLabel);
      bucketTotals[bucket] += row.amount;
      bucketCounts[bucket] += 1;
      return {
        date: row.date,
        category: catLabel,
        description: row.description,
        amount: row.amount,
        source: row.expenseSource === 'automated' ? 'Automated' : 'Manual',
      };
    });

    const categories: ExpenseReportResult['categories'] = [
      {
        key: 'marketing',
        label: 'Marketing',
        description: 'Advertising, campaigns, and brand spend.',
        totalAmount: bucketTotals.marketing,
        entryCount: bucketCounts.marketing,
      },
      {
        key: 'payouts',
        label: 'Payouts',
        description: 'Developer payout allocations and staff salary expenses.',
        totalAmount: bucketTotals.payouts,
        entryCount: bucketCounts.payouts,
      },
      {
        key: 'overheads',
        label: 'Overheads',
        description: 'Hosting, servers, utilities, and project overhead.',
        totalAmount: bucketTotals.overheads,
        entryCount: bucketCounts.overheads,
      },
    ];

    return {
      period: periodInfo.period,
      year: periodInfo.year,
      month: periodInfo.month,
      categories,
      entries,
      totalExpenses: ledger.sumExpense,
    };
  }

  async getProfitLossReport(period: ReportPeriodParams): Promise<ProfitLossReportResult> {
    const periodInfo = resolvePeriod(period);
    const [income, expense, ledger] = await Promise.all([
      this.getIncomeReport(period),
      this.getExpenseReport(period),
      financeLedgerService.getLedger({
        from: periodInfo.from,
        to: periodInfo.to,
        kind: 'all',
      }),
    ]);

    const expenseBreakdown = {
      marketing: expense.categories.find((c) => c.key === 'marketing')?.totalAmount ?? 0,
      payouts: expense.categories.find((c) => c.key === 'payouts')?.totalAmount ?? 0,
      overheads: expense.categories.find((c) => c.key === 'overheads')?.totalAmount ?? 0,
    };

    return {
      period: income.period,
      year: periodInfo.year,
      month: periodInfo.month,
      from: periodInfo.from,
      to: periodInfo.to,
      totalIncome: income.totalIncome,
      totalExpenses: expense.totalExpenses,
      netProfit: calcNetProfit(income.totalIncome, expenseBreakdown),
      profitFormula: PROFIT_FORMULA_LABEL,
      incomeByType: income.categories,
      expenseBreakdown,
      ledgerRows: ledger.rows,
    };
  }

  /** Master Transactions table (MasterLedger / finance ledger). */
  async getTransactionsReport(period?: ReportPeriodParams): Promise<TransactionsReportResult> {
    const periodInfo = resolvePeriod(period);
    const ledger = await financeLedgerService.getLedger({
      from: periodInfo.from,
      to: periodInfo.to,
      kind: 'all',
    });

    const expenseBreakdown = { marketing: 0, payouts: 0, overheads: 0 };
    const entries: TransactionsReportEntry[] = ledger.rows.map((row) => {
      if (row.kind === 'expense') {
        const catLabel = row.expenseCategory || row.categoryLabel.replace(/^Expense · /, '');
        const bucket = expenseBucket(catLabel);
        expenseBreakdown[bucket] += row.amount;
      }
      return {
        date: row.date,
        kind: row.kind,
        category: row.categoryLabel,
        description: row.description,
        amount: row.amount,
        clientName: row.clientName,
        invoiceNumber: row.invoiceNumber,
        referenceId: row.referenceId,
      };
    });

    return {
      period: periodInfo.period,
      sourceTable: 'Transactions',
      totalIncome: ledger.sumIncome,
      totalExpenses: ledger.sumExpense,
      currentBalance: ledger.currentBalance,
      expenseBreakdown,
      netProfit: calcNetProfit(ledger.sumIncome, expenseBreakdown),
      profitFormula: PROFIT_FORMULA_LABEL,
      entries,
    };
  }

  async buildTransactionsReportCsv(period?: ReportPeriodParams): Promise<{ filename: string; csv: string }> {
    const report = await this.getTransactionsReport(period);
    const lines: string[] = [];
    lines.push('Niolla Nexa — Transactions Report');
    lines.push(`Period,${escapeCsv(report.period)}`);
    lines.push(`Source table,${report.sourceTable}`);
    lines.push(`Profit formula,${escapeCsv(report.profitFormula)}`);
    lines.push(`Total income,${report.totalIncome}`);
    lines.push(`Marketing,${report.expenseBreakdown.marketing}`);
    lines.push(`Payouts,${report.expenseBreakdown.payouts}`);
    lines.push(`Overheads,${report.expenseBreakdown.overheads}`);
    lines.push(`Net profit,${report.netProfit}`);
    lines.push('');
    lines.push(csvLine(['Date', 'Type', 'Category', 'Description', 'Client', 'Reference', 'Amount (LKR)']));
    for (const row of report.entries) {
      lines.push(
        csvLine([
          formatReportDate(row.date),
          row.kind,
          row.category,
          row.description,
          row.clientName || '',
          row.invoiceNumber || row.referenceId,
          row.kind === 'income' ? row.amount : -row.amount,
        ])
      );
    }
    return { filename: `transactions-report-${report.period}.csv`, csv: lines.join('\r\n') };
  }

  async buildIncomeReportCsv(period?: ReportPeriodParams): Promise<{ filename: string; csv: string }> {
    const report = await this.getIncomeReport(period);
    const lines: string[] = [];
    lines.push('Niolla Nexa — Income Report');
    lines.push(`Period,${escapeCsv(report.period)}`);
    lines.push(`Total income,${report.totalIncome}`);
    lines.push('');
    lines.push('By category');
    lines.push(csvLine(['Category', 'Count', 'Amount (LKR)']));
    for (const cat of report.categories) {
      lines.push(csvLine([cat.label, cat.invoiceCount, cat.totalAmount]));
    }
    lines.push('');
    lines.push('Detail');
    lines.push(csvLine(['Date', 'Invoice', 'Client', 'Category', 'Amount (LKR)']));
    for (const row of report.entries) {
      lines.push(
        csvLine([
          formatReportDate(row.invoiceDate),
          row.invoiceNumber,
          row.clientName || '',
          row.typeLabel,
          row.amount,
        ])
      );
    }
    return { filename: `income-report-${report.period}.csv`, csv: lines.join('\r\n') };
  }

  async buildExpenseReportCsv(period?: ReportPeriodParams): Promise<{ filename: string; csv: string }> {
    const report = await this.getExpenseReport(period);
    const lines: string[] = [];
    lines.push('Niolla Nexa — Expense Report');
    lines.push(`Period,${escapeCsv(report.period)}`);
    lines.push(`Total expenses,${report.totalExpenses}`);
    lines.push('');
    lines.push('By category');
    lines.push(csvLine(['Category', 'Entries', 'Amount (LKR)']));
    for (const cat of report.categories) {
      lines.push(csvLine([cat.label, cat.entryCount, cat.totalAmount]));
    }
    lines.push('');
    lines.push('Detail');
    lines.push(csvLine(['Date', 'Category', 'Description', 'Source', 'Amount (LKR)']));
    for (const row of report.entries) {
      lines.push(
        csvLine([
          formatReportDate(row.date),
          row.category,
          row.description,
          row.source,
          row.amount,
        ])
      );
    }
    return { filename: `expense-report-${report.period}.csv`, csv: lines.join('\r\n') };
  }

  async buildMonthlyProfitLossCsv(filters: {
    year?: number;
    month?: number;
    from?: string;
    to?: string;
  }): Promise<{ filename: string; csv: string }> {
    let from = filters.from;
    let to = filters.to;
    let periodLabel = 'custom-period';

    if (filters.year && filters.month) {
      const r = monthRangeIso(filters.year, filters.month);
      from = r.from;
      to = r.to;
      periodLabel = r.label;
    } else if (from && to) {
      periodLabel = `${from.slice(0, 10)}_to_${to.slice(0, 10)}`;
    }

    const ledger = await financeLedgerService.getLedger({ from, to, kind: 'all' });
    const expenseBreakdown = { marketing: 0, payouts: 0, overheads: 0 };
    for (const row of ledger.rows) {
      if (row.kind !== 'expense') continue;
      const catLabel = row.expenseCategory || row.categoryLabel.replace(/^Expense · /, '');
      expenseBreakdown[expenseBucket(catLabel)] += row.amount;
    }
    const netProfit = calcNetProfit(ledger.sumIncome, expenseBreakdown);

    const lines: string[] = [];
    lines.push('Niolla Nexa — Profit / Loss Report');
    lines.push(`Period,${escapeCsv(periodLabel)}`);
    lines.push(`Formula,${escapeCsv(PROFIT_FORMULA_LABEL)}`);
    lines.push(`Generated,${escapeCsv(new Date().toISOString())}`);
    lines.push('');
    lines.push('Summary');
    lines.push(csvLine(['Metric', 'Amount (LKR)']));
    lines.push(csvLine(['Total Income', ledger.sumIncome]));
    lines.push(csvLine(['Marketing', expenseBreakdown.marketing]));
    lines.push(csvLine(['Payouts', expenseBreakdown.payouts]));
    lines.push(csvLine(['Overheads', expenseBreakdown.overheads]));
    lines.push(csvLine(['Total Expenses', ledger.sumExpense]));
    lines.push(csvLine(['Net Profit', netProfit]));
    lines.push('');
    lines.push('Transactions');
    lines.push(csvLine(['Date', 'Type', 'Category', 'Description', 'Client', 'Reference', 'Amount (LKR)']));

    for (const row of ledger.rows) {
      lines.push(
        csvLine([
          formatReportDate(row.date),
          row.kind === 'income' ? 'Income' : 'Expense',
          row.categoryLabel,
          row.description,
          row.clientName || '',
          row.invoiceNumber || row.referenceType,
          row.kind === 'income' ? row.amount : -row.amount,
        ])
      );
    }

    return {
      filename: `profit-loss-${periodLabel}.csv`,
      csv: lines.join('\r\n'),
    };
  }

  async getProjectFinancialSheet(projectId: string): Promise<ProjectFinancialSheet | null> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) return null;
    const project = await projectService.findById(projectId);
    if (!project) return null;

    const plans = await PaymentPlanModel.find({ projectId: new mongoose.Types.ObjectId(projectId) })
      .select('_id')
      .lean();
    const planIds = plans.map((p) => p._id);

    const installments = planIds.length
      ? await InstallmentModel.find({ planId: { $in: planIds } }).select('_id').lean()
      : [];
    const installmentIds = installments.map((i) => i._id);

    const payments =
      installmentIds.length > 0
        ? await PaymentTransactionModel.find({ installmentId: { $in: installmentIds } })
            .sort({ paymentDate: -1 })
            .lean()
        : [];

    const collectedPayments = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const invoiceQuery = {
      status: 'paid',
      $or: [
        { projectName: project.projectName },
        ...(payments.length
          ? [{ transactionId: { $in: payments.map((p) => p._id) } }]
          : []),
      ],
    };
    const invoices = await InvoiceModel.find(invoiceQuery).sort({ invoiceDate: -1 }).lean();
    const paidInvoices = invoices.reduce((s, inv) => s + (Number(inv.totalAmount) || 0), 0);

    const expenses = await CompanyExpenseModel.find({ projectId: new mongoose.Types.ObjectId(projectId) })
      .sort({ expenseDate: -1 })
      .lean();
    const linkedExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const infrastructureOverhead = Number(project.expenses) || 0;
    const developerPayouts = Number(project.totalDeveloperPayouts) || 0;
    const contractValue = Number(project.totalValue) || 0;
    const totalCosts = developerPayouts + infrastructureOverhead + linkedExpenses;
    const totalRevenue = Math.max(collectedPayments, paidInvoices);

    const payoutMap = project.assignedEmployeePayouts || {};
    const releaseMap = project.assignedEmployeePayoutRelease || {};
    const devIds = Object.keys(payoutMap);
    const devDocs =
      devIds.length > 0
        ? await UserModel.find({ _id: { $in: devIds } })
            .select('name')
            .lean()
        : [];
    const devNameById: Record<string, string> = {};
    for (const d of devDocs) devNameById[String(d._id)] = (d.name as string) || 'Developer';

    let developerPayoutsPaid = 0;
    let developerPayoutsPending = 0;
    for (const id of devIds) {
      const amt = Number(payoutMap[id]) || 0;
      const st = releaseMap[id] || 'accruing';
      if (st === 'released') developerPayoutsPaid += amt;
      else developerPayoutsPending += amt;
    }

    return {
      projectId,
      projectName: project.projectName,
      clientName: (project as { clientName?: string }).clientName,
      status: String(project.status),
      sourceTable: 'Projects',
      contractValue,
      collectedPayments,
      paidInvoices,
      totalRevenue,
      infrastructureOverhead,
      developerPayouts,
      developerPayoutsPaid,
      developerPayoutsPending,
      linkedExpenses,
      totalCosts,
      contractNetProfit: contractValue - developerPayouts - infrastructureOverhead,
      cashNetProfit: totalRevenue - linkedExpenses,
      paymentRows: payments.map((p) => ({
        date: new Date(p.paymentDate).toISOString(),
        amount: Number(p.amount) || 0,
        method: String(p.paymentMethod || ''),
        reference: p.referenceNo as string | undefined,
      })),
      invoiceRows: invoices.map((inv) => ({
        date: new Date(inv.invoiceDate).toISOString(),
        invoiceNumber: inv.invoiceNumber,
        amount: Number(inv.totalAmount) || 0,
        status: inv.status,
      })),
      expenseRows: expenses.map((e) => ({
        date: new Date(e.expenseDate).toISOString(),
        category: String(e.category),
        description: String(e.description),
        amount: Number(e.amount) || 0,
        source: String(e.source),
      })),
      developerPayoutRows: devIds.map((id) => ({
        developerName: devNameById[id] || 'Developer',
        amount: Number(payoutMap[id]) || 0,
        releaseStatus: releaseMap[id] || 'accruing',
      })),
    };
  }

  async buildProjectFinancialSheetCsv(projectId: string): Promise<{ filename: string; csv: string } | null> {
    const sheet = await this.getProjectFinancialSheet(projectId);
    if (!sheet) return null;

    const safeName = sheet.projectName.replace(/[^\w\-]+/g, '-').slice(0, 40) || 'project';
    const lines: string[] = [];
    lines.push('Niolla Nexa — Project Financial Sheet');
    lines.push(`Project,${escapeCsv(sheet.projectName)}`);
    lines.push(`Client,${escapeCsv(sheet.clientName || '')}`);
    lines.push(`Status,${escapeCsv(sheet.status)}`);
    lines.push(`Generated,${escapeCsv(new Date().toISOString())}`);
    lines.push('');
    lines.push('Summary');
    lines.push(csvLine(['Metric', 'Amount (LKR)']));
    lines.push(csvLine(['Contract value', sheet.contractValue]));
    lines.push(csvLine(['Collected payments', sheet.collectedPayments]));
    lines.push(csvLine(['Paid invoices (linked)', sheet.paidInvoices]));
    lines.push(csvLine(['Developer payouts (allocated)', sheet.developerPayouts]));
    lines.push(csvLine(['Developer payouts paid (released)', sheet.developerPayoutsPaid]));
    lines.push(csvLine(['Developer payouts pending', sheet.developerPayoutsPending]));
    lines.push(csvLine(['Infrastructure / overhead', sheet.infrastructureOverhead]));
    lines.push(csvLine(['Linked company expenses', sheet.linkedExpenses]));
    lines.push(csvLine(['Contract net profit', sheet.contractNetProfit]));
    lines.push(csvLine(['Cash net (revenue − linked expenses)', sheet.cashNetProfit]));
    lines.push('');
    lines.push('Payments received');
    lines.push(csvLine(['Date', 'Amount (LKR)', 'Method', 'Reference']));
    for (const row of sheet.paymentRows) {
      lines.push(csvLine([formatReportDate(row.date), row.amount, row.method, row.reference || '']));
    }
    lines.push('');
    lines.push('Paid invoices');
    lines.push(csvLine(['Date', 'Invoice #', 'Amount (LKR)', 'Status']));
    for (const row of sheet.invoiceRows) {
      lines.push(csvLine([formatReportDate(row.date), row.invoiceNumber, row.amount, row.status]));
    }
    lines.push('');
    lines.push('Project expenses');
    lines.push(csvLine(['Date', 'Category', 'Description', 'Source', 'Amount (LKR)']));
    for (const row of sheet.expenseRows) {
      lines.push(csvLine([formatReportDate(row.date), row.category, row.description, row.source, row.amount]));
    }
    lines.push('');
    lines.push('Developer payouts');
    lines.push(csvLine(['Developer', 'Allocated (LKR)', 'Release status']));
    for (const row of sheet.developerPayoutRows) {
      lines.push(csvLine([row.developerName, row.amount, row.releaseStatus]));
    }

    return { filename: `project-financial-${safeName}.csv`, csv: lines.join('\r\n') };
  }

  async getClientStatement(clientId: string): Promise<ClientStatement | null> {
    if (!mongoose.Types.ObjectId.isValid(clientId)) return null;
    const customer = await CustomerModel.findById(clientId).lean();
    if (!customer) return null;

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const projects = await ProjectModel.find({ clientId: clientOid }).lean();
    const projectIds = projects.map((p) => p._id);
    const projectNameById: Record<string, string> = {};
    for (const p of projects) projectNameById[String(p._id)] = p.projectName;

    const plans =
      projectIds.length > 0
        ? await PaymentPlanModel.find({ projectId: { $in: projectIds } }).lean()
        : [];
    const planIds = plans.map((p) => p._id);
    const planProjectMap: Record<string, string> = {};
    for (const p of plans) planProjectMap[String(p._id)] = String(p.projectId);

    const installments =
      planIds.length > 0
        ? await InstallmentModel.find({ planId: { $in: planIds } }).sort({ dueDate: 1 }).lean()
        : [];

    const payments = await PaymentTransactionModel.find({ clientId: clientOid })
      .sort({ paymentDate: -1 })
      .lean();

    const invoices = await InvoiceModel.find({ clientId: clientOid }).sort({ invoiceDate: -1 }).lean();

    const installmentIds = payments.map((p) => p.installmentId).filter(Boolean);
    const installmentDocs =
      installmentIds.length > 0
        ? await InstallmentModel.find({ _id: { $in: installmentIds } })
            .select('planId')
            .lean()
        : [];
    const instPlanMap: Record<string, string> = {};
    for (const i of installmentDocs) instPlanMap[String(i._id)] = String(i.planId);

    const collectedByProject: Record<string, number> = {};
    for (const pay of payments) {
      const planId = instPlanMap[String(pay.installmentId)];
      const projId = planId ? planProjectMap[planId] : undefined;
      if (projId) collectedByProject[projId] = (collectedByProject[projId] || 0) + (Number(pay.amount) || 0);
    }

    const remainingByProject: Record<string, number> = {};
    for (const plan of plans) {
      const pid = String(plan.projectId);
      remainingByProject[pid] = (remainingByProject[pid] || 0) + (Number(plan.remainingBalance) || 0);
    }

    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalRemainingBalance = plans.reduce((s, p) => s + (Number(p.remainingBalance) || 0), 0);
    const totalContractValue = projects.reduce((s, p) => s + (Number(p.totalValue) || 0), 0);

    return {
      clientId,
      clientName: customer.name,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      sourceTable: 'Clients',
      totalContractValue,
      totalPaid,
      totalRemainingBalance,
      projects: projects.map((p) => {
        const pid = String(p._id);
        return {
          projectId: pid,
          projectName: p.projectName,
          contractValue: Number(p.totalValue) || 0,
          collected: collectedByProject[pid] || 0,
          remainingBalance: remainingByProject[pid] || 0,
          status: String(p.status),
        };
      }),
      paymentRows: payments.map((p) => ({
        date: new Date(p.paymentDate).toISOString(),
        amount: Number(p.amount) || 0,
        method: String(p.paymentMethod || ''),
        reference: p.referenceNo as string | undefined,
      })),
      invoiceRows: invoices.map((inv) => ({
        date: new Date(inv.invoiceDate).toISOString(),
        invoiceNumber: inv.invoiceNumber,
        amount: Number(inv.totalAmount) || 0,
        status: inv.status,
        projectName: inv.projectName as string | undefined,
      })),
      installmentRows: installments.map((inst) => {
        const planId = String(inst.planId);
        const projId = planProjectMap[planId];
        return {
          projectName: projId ? projectNameById[projId] || '—' : '—',
          installmentNo: Number(inst.installmentNo) || 0,
          dueDate: new Date(inst.dueDate).toISOString(),
          dueAmount: Number(inst.dueAmount) || 0,
          paidAmount: Number(inst.paidAmount) || 0,
          status: String(inst.status),
        };
      }),
    };
  }

  async buildClientStatementCsv(clientId: string): Promise<{ filename: string; csv: string } | null> {
    const statement = await this.getClientStatement(clientId);
    if (!statement) return null;

    const safeName = statement.clientName.replace(/[^\w\-]+/g, '-').slice(0, 40) || 'client';
    const lines: string[] = [];
    lines.push('Niolla Nexa — Client Statement');
    lines.push(`Client,${escapeCsv(statement.clientName)}`);
    lines.push(`Phone,${escapeCsv(statement.phoneNumber || '')}`);
    lines.push(`Email,${escapeCsv(statement.email || '')}`);
    lines.push(`Generated,${escapeCsv(new Date().toISOString())}`);
    lines.push('');
    lines.push('Summary');
    lines.push(csvLine(['Metric', 'Amount (LKR)']));
    lines.push(csvLine(['Total contract value', statement.totalContractValue]));
    lines.push(csvLine(['Total paid', statement.totalPaid]));
    lines.push(csvLine(['Remaining balance', statement.totalRemainingBalance]));
    lines.push('');
    lines.push('Projects');
    lines.push(csvLine(['Project', 'Contract value', 'Collected', 'Remaining', 'Status']));
    for (const row of statement.projects) {
      lines.push(
        csvLine([row.projectName, row.contractValue, row.collected, row.remainingBalance, row.status])
      );
    }
    lines.push('');
    lines.push('Payments received');
    lines.push(csvLine(['Date', 'Amount (LKR)', 'Method', 'Reference']));
    for (const row of statement.paymentRows) {
      lines.push(csvLine([formatReportDate(row.date), row.amount, row.method, row.reference || '']));
    }
    lines.push('');
    lines.push('Invoices');
    lines.push(csvLine(['Date', 'Invoice #', 'Project', 'Amount (LKR)', 'Status']));
    for (const row of statement.invoiceRows) {
      lines.push(
        csvLine([
          formatReportDate(row.date),
          row.invoiceNumber,
          row.projectName || '',
          row.amount,
          row.status,
        ])
      );
    }
    lines.push('');
    lines.push('Installment schedule');
    lines.push(csvLine(['Project', 'Installment #', 'Due date', 'Due amount', 'Paid', 'Status']));
    for (const row of statement.installmentRows) {
      lines.push(
        csvLine([
          row.projectName,
          row.installmentNo,
          formatReportDate(row.dueDate),
          row.dueAmount,
          row.paidAmount,
          row.status,
        ])
      );
    }

    return { filename: `client-statement-${safeName}.csv`, csv: lines.join('\r\n') };
  }
}
