import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import { useAuth } from '../context/AuthContext';
import {
  buildDateRange,
  rangeFileSlug,
  rangeQueryString,
  type DatePreset,
} from '../lib/reportDateFilter';
import {
  downloadReportPdf,
  downloadReportXlsx,
} from '../lib/reportExport';
import { ReportFinancialCharts } from '../components/ReportFinancialCharts';
import ProductWiseReports from '../components/ProductWiseReports';
import styles from './Inquiries.module.css';

type ReportTab =
  | 'project-summary'
  | 'client-statement'
  | 'transactions'
  | 'income'
  | 'expenses'
  | 'pl'
  | 'project-progress'
  | 'staff'
  | 'staff-wallet'
  | 'marketing-roi'
  | 'product-reports';

type IncomeInvoiceType = 'ADVANCE_PAYMENT' | 'MONTHLY_INSTALLMENT' | 'BALANCE_PAYMENT';

interface IncomeCategorySummary {
  invoiceType: IncomeInvoiceType;
  label: string;
  description: string;
  totalAmount: number;
  invoiceCount: number;
}

interface IncomeReportEntry {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientName?: string;
  amount: number;
  invoiceType: IncomeInvoiceType;
  typeLabel: string;
}

interface IncomeReportResult {
  period: string;
  categories: IncomeCategorySummary[];
  entries: IncomeReportEntry[];
  totalIncome: number;
}

interface ExpenseCategorySummary {
  key: 'marketing' | 'payouts' | 'overheads';
  label: string;
  description: string;
  totalAmount: number;
  entryCount: number;
}

interface ExpenseReportEntry {
  date: string;
  category: string;
  description: string;
  amount: number;
  source: string;
}

interface ExpenseReportResult {
  period: string;
  categories: ExpenseCategorySummary[];
  entries: ExpenseReportEntry[];
  totalExpenses: number;
}

interface ProfitLossReportResult {
  period: string;
  year?: number;
  month?: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitFormula: string;
  incomeByType: IncomeCategorySummary[];
  expenseBreakdown: {
    marketing: number;
    payouts: number;
    overheads: number;
  };
}

interface TransactionsReportResult {
  period: string;
  sourceTable: 'Transactions';
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  netProfit: number;
  profitFormula: string;
  expenseBreakdown: { marketing: number; payouts: number; overheads: number };
  entries: {
    date: string;
    kind: 'income' | 'expense';
    category: string;
    description: string;
    amount: number;
    clientName?: string;
    invoiceNumber?: string;
    referenceId: string;
  }[];
}

interface StaffWalletEntry {
  entryId: string;
  developerName: string;
  projectName: string;
  amount: number;
  walletStatus: string;
  submittedAt: string;
  approvedAt?: string;
}

interface StaffWalletReport {
  period: string;
  sourceTable: 'Staff_Wallet';
  totalEntries: number;
  totalAmount: number;
  entries: StaffWalletEntry[];
}

interface OverdueRow {
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

interface ProjectProgressRow {
  projectId: string;
  projectName: string;
  clientName?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  daysRemaining: number | null;
  isOverdue: boolean;
  totalValue: number;
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;
  assignedDevelopers: number;
}

interface ProjectProgressReport {
  activeProjectCount: number;
  projects: ProjectProgressRow[];
}

interface StaffPerformanceRow {
  developerId: string;
  developerName: string;
  email: string;
  walletBalance: number;
  baseSalary: number;
  totalEarned: number;
  earnedThisMonth: number;
  pendingPayout: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  completionRate: number;
}

interface StaffPerformanceReport {
  developerCount: number;
  staff: StaffPerformanceRow[];
}

interface MarketingRoiReport {
  rows: {
    expenseId: string;
    description: string;
    expenseDate: string;
    marketingSpend: number;
    projectId?: string;
    projectName?: string;
    projectValue: number;
    roiPercent: number | null;
    returnMultiple: number | null;
  }[];
  totalMarketingSpend: number;
  attributedSpend: number;
  attributedProjectValue: number;
  overallRoiPercent: number | null;
  periodNetProfit?: number;
  periodIncome?: number;
  profitFormula?: string;
  marketingVsProfitNote?: string;
}

interface ProjectFinancialSheet {
  projectId: string;
  projectName: string;
  clientName?: string;
  status: string;
  sourceTable: 'Projects';
  contractValue: number;
  collectedPayments: number;
  developerPayouts: number;
  developerPayoutsPaid: number;
  developerPayoutsPending: number;
  infrastructureOverhead: number;
  contractNetProfit: number;
  developerPayoutRows: { developerName: string; amount: number; releaseStatus: string }[];
}

interface ClientStatement {
  clientId: string;
  clientName: string;
  email?: string;
  phoneNumber?: string;
  sourceTable: 'Clients';
  totalContractValue: number;
  totalPaid: number;
  totalRemainingBalance: number;
  projects: {
    projectId: string;
    projectName: string;
    contractValue: number;
    collected: number;
    remainingBalance: number;
    status: string;
  }[];
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

const INCOME_TYPE_ORDER: IncomeInvoiceType[] = ['ADVANCE_PAYMENT', 'MONTHLY_INSTALLMENT', 'BALANCE_PAYMENT'];

const incomeTypeShortLabel = (t: IncomeInvoiceType): string => {
  switch (t) {
    case 'ADVANCE_PAYMENT':
      return 'Advance';
    case 'MONTHLY_INSTALLMENT':
      return 'Installment';
    case 'BALANCE_PAYMENT':
      return 'Balance';
    default:
      return t;
  }
};

const TAB_LABELS: Record<ReportTab, string> = {
  'project-summary': 'Project Summary',
  'client-statement': 'Client Statement',
  transactions: 'Transactions',
  income: 'Income Report',
  expenses: 'Expense Report',
  pl: 'Profit & Loss',
  'project-progress': 'Project Progress',
  staff: 'Staff Performance',
  'staff-wallet': 'Staff Wallet',
  'marketing-roi': 'Marketing Report',
  'product-reports': 'Product Reports',
};

const TAB_GROUPS: { label: string; tabs: ReportTab[] }[] = [
  {
    label: 'At a glance',
    tabs: ['project-summary', 'marketing-roi', 'client-statement'],
  },
  { label: 'Products', tabs: ['product-reports'] },
  { label: 'Financial (Transactions table)', tabs: ['transactions', 'income', 'expenses', 'pl'] },
  { label: 'Projects table', tabs: ['project-progress'] },
  { label: 'Staff_Wallet table', tabs: ['staff', 'staff-wallet'] },
];

const DATE_FILTERED_TABS: ReportTab[] = [
  'transactions',
  'income',
  'expenses',
  'pl',
  'staff-wallet',
  'marketing-roi',
  'product-reports',
];

/** Super Admin only — company financials and P&L. */
const FINANCIAL_ONLY_TABS: ReportTab[] = [
  'project-summary',
  'client-statement',
  'transactions',
  'income',
  'expenses',
  'pl',
  'product-reports',
];

type ExportFormat = 'csv' | 'excel' | 'pdf';

export default function Reports() {
  const { user } = useAuth();
  const canViewFinancial = user?.role === 'owner';
  const canViewReports = user?.role === 'owner' || user?.role === 'pm';
  const visibleTabGroups = TAB_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => canViewFinancial || !FINANCIAL_ONLY_TABS.includes(tab)),
  })).filter((group) => group.tabs.length > 0);
  const [datePreset, setDatePreset] = useState<DatePreset>('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('project-summary');
  const [projectOptions, setProjectOptions] = useState<{ _id: string; projectName: string }[]>([]);
  const [clientOptions, setClientOptions] = useState<{ _id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [projectSheet, setProjectSheet] = useState<ProjectFinancialSheet | null>(null);
  const [clientStatement, setClientStatement] = useState<ClientStatement | null>(null);
  const [incomeReport, setIncomeReport] = useState<IncomeReportResult | null>(null);
  const [expenseReport, setExpenseReport] = useState<ExpenseReportResult | null>(null);
  const [plReport, setPlReport] = useState<ProfitLossReportResult | null>(null);
  const [transactionsReport, setTransactionsReport] = useState<TransactionsReportResult | null>(null);
  const [projectProgress, setProjectProgress] = useState<ProjectProgressReport | null>(null);
  const [staffReport, setStaffReport] = useState<StaffPerformanceReport | null>(null);
  const [staffWalletReport, setStaffWalletReport] = useState<StaffWalletReport | null>(null);
  const [marketingRoi, setMarketingRoi] = useState<MarketingRoiReport | null>(null);
  const [overdueList, setOverdueList] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [productOptions, setProductOptions] = useState<{ _id: string; name: string; code: string }[]>([]);
  const [groupByProductId, setGroupByProductId] = useState('');

  const dateRange = useMemo(
    () => buildDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  );
  const rangeQuery = useMemo(() => {
    const base = rangeQueryString(dateRange);
    if (!groupByProductId) return base;
    const sep = base ? '&' : '';
    return `${base}${sep}productId=${groupByProductId}`;
  }, [dateRange, groupByProductId]);
  const usesDateFilter = DATE_FILTERED_TABS.includes(activeTab);
  const usesProductFilter =
    usesDateFilter || activeTab === 'product-reports';

  const loadActiveReport = useCallback(async () => {
    if (!canViewFinancial) return;
    setLoading(true);
    try {
      if (activeTab === 'transactions') {
        const res = await api.get<TransactionsReportResult>(`/reports/transactions?${rangeQuery}`);
        if (res.success && res.data) setTransactionsReport(res.data);
      } else if (activeTab === 'income') {
        const res = await api.get<IncomeReportResult>(`/reports/financial/income?${rangeQuery}`);
        if (res.success && res.data) setIncomeReport(res.data);
      } else if (activeTab === 'expenses') {
        const res = await api.get<ExpenseReportResult>(`/reports/financial/expenses?${rangeQuery}`);
        if (res.success && res.data) setExpenseReport(res.data);
      } else if (activeTab === 'pl') {
        const res = await api.get<ProfitLossReportResult>(`/reports/financial/pl?${rangeQuery}`);
        if (res.success && res.data) setPlReport(res.data);
      } else if (activeTab === 'project-progress') {
        const res = await api.get<ProjectProgressReport>('/reports/project-progress');
        if (res.success && res.data) setProjectProgress(res.data);
      } else if (activeTab === 'staff') {
        const res = await api.get<StaffPerformanceReport>('/reports/staff-performance');
        if (res.success && res.data) setStaffReport(res.data);
      } else if (activeTab === 'staff-wallet') {
        const res = await api.get<StaffWalletReport>(`/reports/staff-wallet?${rangeQuery}`);
        if (res.success && res.data) setStaffWalletReport(res.data);
      } else if (activeTab === 'project-summary' && selectedProjectId) {
        const res = await api.get<ProjectFinancialSheet>(`/reports/project-financial/${selectedProjectId}`);
        if (res.success && res.data) setProjectSheet(res.data);
      } else if (activeTab === 'client-statement' && selectedClientId) {
        const res = await api.get<ClientStatement>(`/reports/client-statement/${selectedClientId}`);
        if (res.success && res.data) setClientStatement(res.data);
      } else if (activeTab === 'marketing-roi') {
        const res = await api.get<MarketingRoiReport>(`/reports/marketing-roi?${rangeQuery}`);
        if (res.success && res.data) setMarketingRoi(res.data);
      }
    } catch (err) {
      pushSystemToast(err instanceof Error ? err.message : 'Failed to load report.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, canViewFinancial, rangeQuery, selectedProjectId, selectedClientId]);

  useEffect(() => {
    if (!canViewFinancial) return;
    api.get<{ _id: string; name: string; code: string }[]>('/products?activeOnly=true').then((res) => {
      if (res.success && Array.isArray(res.data)) setProductOptions(res.data);
    });
  }, [canViewFinancial]);

  useEffect(() => {
    if (!canViewFinancial) return;
    void Promise.all([api.get<unknown[]>('/projects'), api.get<unknown[]>('/customers')]).then(
      ([pRes, cRes]) => {
        if (pRes.success && Array.isArray(pRes.data)) {
          const list = pRes.data as { _id: string; projectName: string }[];
          setProjectOptions(list);
          if (list.length > 0) setSelectedProjectId((prev) => prev || list[0]._id);
        }
        if (cRes.success && Array.isArray(cRes.data)) {
          const list = cRes.data as { _id: string; name: string }[];
          setClientOptions(list);
          if (list.length > 0) setSelectedClientId((prev) => prev || list[0]._id);
        }
      }
    );
  }, [canViewFinancial]);

  useEffect(() => {
    if (datePreset === 'custom' && !customFrom && !customTo) {
      const range = buildDateRange('monthly');
      setCustomFrom(range.from.slice(0, 10));
      setCustomTo(range.to.slice(0, 10));
    }
  }, [datePreset, customFrom, customTo]);

  useEffect(() => {
    void loadActiveReport();
  }, [loadActiveReport]);

  useEffect(() => {
    api.get<OverdueRow[]>('/reports/overdue-list').then((res) => {
      if (res.success && res.data) setOverdueList(res.data);
    });
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatRs = (n: number) => `Rs. ${Number(n).toLocaleString()}`;
  const fileSlug = rangeFileSlug(dateRange);

  const exportTable = (
    format: 'pdf' | 'excel',
    filename: string,
    title: string,
    period: string,
    rows: (string | number)[][],
    summary?: { label: string; value: string }[]
  ) => {
    const headers = rows[0] as string[];
    const dataRows = rows.slice(1);
    if (format === 'excel') {
      downloadReportXlsx(filename, rows);
      return;
    }
    downloadReportPdf({
      filename,
      title,
      periodLabel: period,
      summary,
      headers,
      rows: dataRows,
    });
  };

  const exportReport = async (format: ExportFormat) => {
    setDownloading(true);
    try {
      const title = TAB_LABELS[activeTab];
      const period = usesDateFilter ? dateRange.label : 'Current snapshot';

      if (format === 'csv') {
        if (activeTab === 'transactions') {
          await api.download(`/reports/transactions/download?${rangeQuery}`, `transactions-${fileSlug}.csv`);
        } else if (activeTab === 'income') {
          await api.download(`/reports/financial/income/download?${rangeQuery}`, `income-${fileSlug}.csv`);
        } else if (activeTab === 'expenses') {
          await api.download(`/reports/financial/expenses/download?${rangeQuery}`, `expenses-${fileSlug}.csv`);
        } else if (activeTab === 'pl') {
          await api.download(`/reports/monthly-profit-loss/download?${rangeQuery}`, `profit-loss-${fileSlug}.csv`);
        } else if (activeTab === 'project-progress') {
          await api.download('/reports/project-progress/download', 'project-progress.csv');
        } else if (activeTab === 'staff') {
          await api.download('/reports/staff-performance/download', 'staff-performance.csv');
        } else if (activeTab === 'staff-wallet') {
          await api.download(`/reports/staff-wallet/download?${rangeQuery}`, `staff-wallet-${fileSlug}.csv`);
        } else if (activeTab === 'project-summary' && selectedProjectId) {
          await api.download(
            `/reports/project-financial/${selectedProjectId}/download`,
            `project-summary-${fileSlug}.csv`
          );
        } else if (activeTab === 'client-statement' && selectedClientId) {
          await api.download(
            `/reports/client-statement/${selectedClientId}/download`,
            `client-statement-${fileSlug}.csv`
          );
        } else if (activeTab === 'marketing-roi') {
          await api.download(`/reports/marketing-roi/download?${rangeQuery}`, `marketing-roi-${fileSlug}.csv`);
        }
        return;
      }

      if (activeTab === 'transactions' && transactionsReport) {
        const rows: (string | number)[][] = [
          ['Date', 'Type', 'Category', 'Description', 'Client', 'Reference', 'Amount (LKR)'],
          ...transactionsReport.entries.map((r) => [
            formatDate(r.date),
            r.kind,
            r.category,
            r.description,
            r.clientName || '',
            r.invoiceNumber || r.referenceId,
            r.kind === 'income' ? r.amount : -r.amount,
          ]),
        ];
        exportTable(format, `transactions-${fileSlug}`, title, period, rows, [
          { label: 'Total income', value: formatRs(transactionsReport.totalIncome) },
          { label: 'Marketing', value: formatRs(transactionsReport.expenseBreakdown.marketing) },
          { label: 'Payouts', value: formatRs(transactionsReport.expenseBreakdown.payouts) },
          { label: 'Overheads', value: formatRs(transactionsReport.expenseBreakdown.overheads) },
          { label: 'Net profit', value: formatRs(transactionsReport.netProfit) },
        ]);
      } else if (activeTab === 'income' && incomeReport) {
        const rows: (string | number)[][] = [
          ['Date', 'Invoice', 'Client', 'Category', 'Amount (LKR)'],
          ...incomeReport.entries.map((r) => [
            formatDate(r.invoiceDate),
            r.invoiceNumber,
            r.clientName || '',
            r.typeLabel,
            r.amount,
          ]),
        ];
        exportTable(format, `income-${fileSlug}`, title, period, rows, [
          { label: 'Total income', value: formatRs(incomeReport.totalIncome) },
        ]);
      } else if (activeTab === 'expenses' && expenseReport) {
        const rows: (string | number)[][] = [
          ['Date', 'Category', 'Description', 'Source', 'Amount (LKR)'],
          ...expenseReport.entries.map((r) => [formatDate(r.date), r.category, r.description, r.source, r.amount]),
        ];
        exportTable(format, `expenses-${fileSlug}`, title, period, rows, [
          { label: 'Total expenses', value: formatRs(expenseReport.totalExpenses) },
        ]);
      } else if (activeTab === 'pl' && plReport) {
        const rows: (string | number)[][] = [
          ['Metric', 'Amount (LKR)'],
          ['Income', plReport.totalIncome],
          ['Expenses', plReport.totalExpenses],
          ['Net profit', plReport.netProfit],
        ];
        exportTable(format, `profit-loss-${fileSlug}`, title, period, rows, [
          { label: 'Income', value: formatRs(plReport.totalIncome) },
          { label: 'Marketing', value: formatRs(plReport.expenseBreakdown.marketing) },
          { label: 'Payouts', value: formatRs(plReport.expenseBreakdown.payouts) },
          { label: 'Overheads', value: formatRs(plReport.expenseBreakdown.overheads) },
          { label: 'Net profit', value: formatRs(plReport.netProfit) },
        ]);
      } else if (activeTab === 'project-progress' && projectProgress) {
        const rows: (string | number)[][] = [
          ['Project', 'Client', 'End', 'Days left', 'Progress %', 'Value (LKR)'],
          ...projectProgress.projects.map((r) => [
            r.projectName,
            r.clientName || '',
            r.endDate ? formatDate(r.endDate) : '',
            r.daysRemaining ?? '',
            r.completionPercent,
            r.totalValue,
          ]),
        ];
        exportTable(format, 'project-progress', title, period, rows);
      } else if (activeTab === 'staff' && staffReport) {
        const rows: (string | number)[][] = [
          ['Developer', 'Wallet', 'Earned', 'Tasks done', 'Open', 'Completion %'],
          ...staffReport.staff.map((r) => [
            r.developerName,
            r.walletBalance,
            r.totalEarned,
            r.completedTasks,
            r.openTasks,
            r.completionRate,
          ]),
        ];
        exportTable(format, 'staff-performance', title, period, rows);
      } else if (activeTab === 'staff-wallet' && staffWalletReport) {
        const rows: (string | number)[][] = [
          ['Developer', 'Project', 'Amount', 'Status', 'Submitted', 'Approved'],
          ...staffWalletReport.entries.map((r) => [
            r.developerName,
            r.projectName,
            r.amount,
            r.walletStatus,
            formatDate(r.submittedAt),
            r.approvedAt ? formatDate(r.approvedAt) : '',
          ]),
        ];
        exportTable(format, `staff-wallet-${fileSlug}`, title, period, rows, [
          { label: 'Total entries', value: String(staffWalletReport.totalEntries) },
          { label: 'Total amount', value: formatRs(staffWalletReport.totalAmount) },
        ]);
      } else if (activeTab === 'project-summary' && projectSheet) {
        const rows: (string | number)[][] = [
          ['Developer', 'Allocated (LKR)', 'Release status'],
          ...projectSheet.developerPayoutRows.map((r) => [r.developerName, r.amount, r.releaseStatus]),
        ];
        exportTable(format, `project-summary-${fileSlug}`, title, period, rows, [
          { label: 'Project', value: projectSheet.projectName },
          { label: 'Paid to developers', value: formatRs(projectSheet.developerPayoutsPaid) },
          { label: 'Pending payouts', value: formatRs(projectSheet.developerPayoutsPending) },
          { label: 'Contract value', value: formatRs(projectSheet.contractValue) },
        ]);
      } else if (activeTab === 'client-statement' && clientStatement) {
        const rows: (string | number)[][] = [
          ['Project', 'Contract', 'Collected', 'Remaining', 'Status'],
          ...clientStatement.projects.map((r) => [
            r.projectName,
            r.contractValue,
            r.collected,
            r.remainingBalance,
            r.status,
          ]),
        ];
        exportTable(format, `client-statement-${fileSlug}`, title, period, rows, [
          { label: 'Client', value: clientStatement.clientName },
          { label: 'Total paid', value: formatRs(clientStatement.totalPaid) },
          { label: 'Remaining balance', value: formatRs(clientStatement.totalRemainingBalance) },
        ]);
      } else if (activeTab === 'marketing-roi' && marketingRoi) {
        const rows: (string | number)[][] = [
          ['Date', 'Description', 'Spend', 'Project', 'Value', 'ROI %'],
          ...marketingRoi.rows.map((r) => [
            formatDate(r.expenseDate),
            r.description,
            r.marketingSpend,
            r.projectName || '',
            r.projectValue,
            r.roiPercent ?? '',
          ]),
        ];
        exportTable(format, `marketing-roi-${fileSlug}`, title, period, rows, [
          { label: 'Marketing spend', value: formatRs(marketingRoi.totalMarketingSpend) },
          { label: 'Period net profit', value: formatRs(marketingRoi.periodNetProfit ?? 0) },
          { label: 'Attributed project value', value: formatRs(marketingRoi.attributedProjectValue) },
          {
            label: 'Overall ROI',
            value: marketingRoi.overallRoiPercent != null ? `${marketingRoi.overallRoiPercent.toFixed(1)}%` : '—',
          },
        ]);
      } else {
        pushSystemToast('Load the report first, then export.', 'error');
      }
    } catch (err) {
      pushSystemToast(err instanceof Error ? err.message : 'Export failed.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const renderCategoryCards = (
    items: { key: string; label: string; description: string; total: number; count: number; countLabel: string }[]
  ) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {items.map((cat) => (
        <div
          key={cat.key}
          className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-2"
        >
          <span className="text-sm font-bold text-primary">{cat.label}</span>
          <p className="text-xs text-gray-600 leading-relaxed flex-1">{cat.description}</p>
          <div className="pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Total</span>
            <p className="text-lg font-bold text-gray-900">Rs. {Number(cat.total).toLocaleString()}</p>
            <span className="text-xs text-gray-500">
              {cat.count} {cat.countLabel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderProjectSummaryTab = () => (
    <>
      <p className="text-sm text-gray-600 max-w-3xl mb-4">
        <strong className="font-semibold text-gray-800">Project Summary</strong> — see how much has been paid to
        developers on each project (released wallet payouts vs pending).
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-gray-700">
          Project
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="mt-1 block min-w-[220px] px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
          >
            {projectOptions.length === 0 ? (
              <option value="">No projects</option>
            ) : (
              projectOptions.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.projectName}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      {!projectSheet ? (
        <p className="text-sm text-gray-500">Select a project to load the summary.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 max-w-5xl">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Contract value</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                Rs. {Number(projectSheet.contractValue).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Collected</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                Rs. {Number(projectSheet.collectedPayments).toLocaleString()}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-600 uppercase tracking-wide">Paid to developers</span>
              <p className="text-2xl font-bold text-emerald-800 mt-1">
                Rs. {Number(projectSheet.developerPayoutsPaid).toLocaleString()}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-600 uppercase tracking-wide">Pending payouts</span>
              <p className="text-2xl font-bold text-amber-800 mt-1">
                Rs. {Number(projectSheet.developerPayoutsPending).toLocaleString()}
              </p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">Developer</th>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">Allocated</th>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y-0">
                {projectSheet.developerPayoutRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      No developer payouts on this project.
                    </td>
                  </tr>
                ) : (
                  projectSheet.developerPayoutRows.map((row) => (
                    <tr key={row.developerName} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.developerName}</td>
                      <td className="px-6 py-4">Rs. {Number(row.amount).toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-600">{row.releaseStatus}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );

  const renderClientStatementTab = () => (
    <>
      <p className="text-sm text-gray-600 max-w-3xl mb-4">
        <strong className="font-semibold text-gray-800">Client Statement</strong> — remaining balance and payment
        history for each client.
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-gray-700">
          Client
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="mt-1 block min-w-[220px] px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
          >
            {clientOptions.length === 0 ? (
              <option value="">No clients</option>
            ) : (
              clientOptions.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      {!clientStatement ? (
        <p className="text-sm text-gray-500">Select a client to load their statement.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 max-w-4xl">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Contract total</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                Rs. {Number(clientStatement.totalContractValue).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Total paid</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                Rs. {Number(clientStatement.totalPaid).toLocaleString()}
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-600 uppercase tracking-wide">Remaining balance</span>
              <p className="text-2xl font-bold text-orange-800 mt-1">
                Rs. {Number(clientStatement.totalRemainingBalance).toLocaleString()}
              </p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project</th>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">Contract</th>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">Collected</th>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y-0">
                {clientStatement.projects.map((row) => (
                  <tr key={row.projectId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.projectName}</td>
                    <td className="px-6 py-4">Rs. {Number(row.contractValue).toLocaleString()}</td>
                    <td className="px-6 py-4 text-emerald-700">Rs. {Number(row.collected).toLocaleString()}</td>
                    <td className="px-6 py-4 text-orange-700 font-medium">
                      Rs. {Number(row.remainingBalance).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );

  const renderTransactionsTab = () => {
    if (!transactionsReport) return null;
    const profitPositive = transactionsReport.netProfit >= 0;
    return (
      <>
        <p className="text-sm text-gray-600 max-w-3xl mb-4">
          Master ledger from the <strong className="font-semibold text-gray-800">Transactions</strong> table for{' '}
          <strong className="font-semibold text-gray-800">{dateRange.label}</strong>. Net profit:{' '}
          <span className="font-medium text-gray-800">{transactionsReport.profitFormula}</span>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 max-w-5xl">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Income</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              Rs. {Number(transactionsReport.totalIncome).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Expenses</span>
            <p className="text-2xl font-bold text-red-700 mt-1">
              Rs. {Number(transactionsReport.totalExpenses).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Balance</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              Rs. {Number(transactionsReport.currentBalance).toLocaleString()}
            </p>
          </div>
          <div
            className={`rounded-xl p-4 shadow-sm border ${
              profitPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <span className="text-xs text-gray-600 uppercase tracking-wide">Net profit</span>
            <p className={`text-2xl font-bold mt-1 ${profitPositive ? 'text-emerald-800' : 'text-red-800'}`}>
              Rs. {Number(transactionsReport.netProfit).toLocaleString()}
            </p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Date</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Type</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Category</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Description</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Client / Ref</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {transactionsReport.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No ledger entries in this period.
                  </td>
                </tr>
              ) : (
                transactionsReport.entries.map((row, i) => (
                  <tr key={`${row.referenceId}-${i}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">{formatDate(row.date)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          row.kind === 'income' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                        }`}
                      >
                        {row.kind}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-medium">{row.category}</td>
                    <td className="px-6 py-4 text-gray-600">{row.description}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {row.clientName || row.invoiceNumber || row.referenceId}
                    </td>
                    <td
                      className={`px-6 py-4 font-medium ${
                        row.kind === 'income' ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {row.kind === 'income' ? '+' : '−'} Rs. {Number(row.amount).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderIncomeTab = () => {
    if (!incomeReport) return null;
    const cards = [...incomeReport.categories]
      .sort((a, b) => INCOME_TYPE_ORDER.indexOf(a.invoiceType) - INCOME_TYPE_ORDER.indexOf(b.invoiceType))
      .map((cat) => ({
        key: cat.invoiceType,
        label: cat.label,
        description: cat.description,
        total: cat.totalAmount,
        count: cat.invoiceCount,
        countLabel: 'invoice(s)',
      }));

    return (
      <>
        <p className="text-sm text-gray-600 max-w-3xl mb-4">
          Income received through advances, monthly installments, and remaining balance payments — paid
          invoices for <strong className="font-semibold text-gray-800">{dateRange.label}</strong>.
        </p>
        {renderCategoryCards(cards)}
        <div className="mb-4 flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium text-gray-700">Total income</span>
          <span className="text-xl font-bold text-gray-900">
            Rs. {Number(incomeReport.totalIncome).toLocaleString()}
          </span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Invoice</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Client</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Date</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Category</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {incomeReport.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No paid invoices in this period.
                  </td>
                </tr>
              ) : (
                incomeReport.entries.map((row) => (
                  <tr key={row.invoiceId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.invoiceNumber}</td>
                    <td className="px-6 py-4 text-gray-600">{row.clientName || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(row.invoiceDate)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-50 text-orange-800">
                        {incomeTypeShortLabel(row.invoiceType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">Rs. {Number(row.amount).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderExpenseTab = () => {
    if (!expenseReport) return null;
    const cards = expenseReport.categories.map((cat) => ({
      key: cat.key,
      label: cat.label,
      description: cat.description,
      total: cat.totalAmount,
      count: cat.entryCount,
      countLabel: 'entry(ies)',
    }));

    return (
      <>
        <p className="text-sm text-gray-600 max-w-3xl mb-4">
          Company expenses for marketing, payouts, and overheads for{' '}
          <strong className="font-semibold text-gray-800">{dateRange.label}</strong>.
        </p>
        {renderCategoryCards(cards)}
        <div className="mb-4 flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium text-gray-700">Total expenses</span>
          <span className="text-xl font-bold text-gray-900">
            Rs. {Number(expenseReport.totalExpenses).toLocaleString()}
          </span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Date</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Category</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Description</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Source</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {expenseReport.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No expenses in this period.
                  </td>
                </tr>
              ) : (
                expenseReport.entries.map((row, i) => (
                  <tr key={`${row.date}-${row.description}-${i}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">{formatDate(row.date)}</td>
                    <td className="px-6 py-4 text-gray-800 font-medium">{row.category}</td>
                    <td className="px-6 py-4 text-gray-600">{row.description}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{row.source}</td>
                    <td className="px-6 py-4 font-medium">Rs. {Number(row.amount).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderPlTab = () => {
    if (!plReport) return null;
    const profitPositive = plReport.netProfit >= 0;

    return (
      <>
        <p className="text-sm text-gray-600 max-w-3xl mb-4">
          Profit and loss for <strong className="font-semibold text-gray-800">{dateRange.label}</strong>:{' '}
          <span className="font-medium text-gray-800">{plReport.profitFormula}</span>.
        </p>
        <ReportFinancialCharts
          incomeTotal={plReport.totalIncome}
          expenseTotal={plReport.totalExpenses}
          netProfit={plReport.netProfit}
          incomeSlices={plReport.incomeByType.map((c) => ({ label: c.label, value: c.totalAmount }))}
          expenseSlices={[
            { label: 'Marketing', value: plReport.expenseBreakdown.marketing },
            { label: 'Payouts', value: plReport.expenseBreakdown.payouts },
            { label: 'Overheads', value: plReport.expenseBreakdown.overheads },
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 max-w-3xl">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Income</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              Rs. {Number(plReport.totalIncome).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Expenses</span>
            <p className="text-2xl font-bold text-red-700 mt-1">
              Rs. {Number(plReport.totalExpenses).toLocaleString()}
            </p>
          </div>
          <div
            className={`rounded-xl p-4 shadow-sm border ${
              profitPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <span className="text-xs text-gray-600 uppercase tracking-wide">Net profit</span>
            <p className={`text-2xl font-bold mt-1 ${profitPositive ? 'text-emerald-800' : 'text-red-800'}`}>
              Rs. {Number(plReport.netProfit).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Income breakdown</h3>
            <ul className="space-y-2 text-sm">
              {plReport.incomeByType.map((row) => (
                <li key={row.invoiceType} className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                  <span className="text-gray-700">{row.label}</span>
                  <span className="font-semibold text-gray-900">Rs. {Number(row.totalAmount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Expense breakdown</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span className="text-gray-700">Marketing</span>
                <span className="font-semibold text-gray-900">
                  Rs. {Number(plReport.expenseBreakdown.marketing).toLocaleString()}
                </span>
              </li>
              <li className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span className="text-gray-700">Payouts</span>
                <span className="font-semibold text-gray-900">
                  Rs. {Number(plReport.expenseBreakdown.payouts).toLocaleString()}
                </span>
              </li>
              <li className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span className="text-gray-700">Overheads</span>
                <span className="font-semibold text-gray-900">
                  Rs. {Number(plReport.expenseBreakdown.overheads).toLocaleString()}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </>
    );
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'under_development':
        return 'In development';
      case 'unassigned':
        return 'Unassigned';
      case 'completed':
        return 'Completed';
      case 'suspended':
        return 'Suspended';
      default:
        return status;
    }
  };

  const renderProjectProgressTab = () => {
    if (!projectProgress) return null;
    return (
      <>
        <p className="text-sm text-gray-600 max-w-3xl mb-4">
          Active projects with task completion and time remaining until the scheduled end date.
        </p>
        <div className="mb-4 flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium text-gray-700">Active projects</span>
          <span className="text-xl font-bold text-gray-900">{projectProgress.activeProjectCount}</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Client</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">End date</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Time left</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Progress</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {projectProgress.projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No active projects.
                  </td>
                </tr>
              ) : (
                projectProgress.projects.map((row) => (
                  <tr key={row.projectId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.projectName}</td>
                    <td className="px-6 py-4 text-gray-600">{row.clientName || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{statusLabel(row.status)}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {row.endDate ? formatDate(row.endDate) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {row.daysRemaining === null ? (
                        <span className="text-gray-400">No deadline</span>
                      ) : row.isOverdue ? (
                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                          {Math.abs(row.daysRemaining)}d overdue
                        </span>
                      ) : (
                        <span className="text-gray-700">{row.daysRemaining}d left</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${row.completionPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          {row.completedTasks}/{row.totalTasks} ({row.completionPercent}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">Rs. {Number(row.totalValue).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderStaffTab = () => {
    if (!staffReport) return null;
    return (
      <>
        <p className="text-sm text-gray-600 max-w-3xl mb-4">
          Developer earnings, wallet balances, and task completion volume across all assigned work.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Developer</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Wallet</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Total earned</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">This month</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Pending</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Active projects</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Tasks done</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Open tasks</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {staffReport.staff.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    No developers on the team.
                  </td>
                </tr>
              ) : (
                staffReport.staff.map((row) => (
                  <tr key={row.developerId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{row.developerName}</div>
                      <div className="text-xs text-gray-500">{row.email}</div>
                    </td>
                    <td className="px-6 py-4 font-medium">Rs. {Number(row.walletBalance).toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-800">Rs. {Number(row.totalEarned).toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600">Rs. {Number(row.earnedThisMonth).toLocaleString()}</td>
                    <td className="px-6 py-4 text-amber-700">Rs. {Number(row.pendingPayout).toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600">{row.activeProjects}</td>
                    <td className="px-6 py-4 text-gray-800 font-medium">{row.completedTasks}</td>
                    <td className="px-6 py-4 text-gray-600">{row.openTasks}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-50 text-orange-800">
                        {row.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderStaffWalletTab = () => {
    if (!staffWalletReport) return null;
    return (
      <>
        <p className="text-sm text-gray-600 max-w-3xl mb-4">
          Ledger entries from the <strong className="font-semibold text-gray-800">Staff_Wallet</strong> table for{' '}
          <strong className="font-semibold text-gray-800">{dateRange.label}</strong>.
        </p>
        <div className="mb-4 flex flex-wrap items-baseline gap-4">
          <div>
            <span className="text-sm font-medium text-gray-700">Total entries </span>
            <span className="text-xl font-bold text-gray-900">{staffWalletReport.totalEntries}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Total amount </span>
            <span className="text-xl font-bold text-gray-900">
              Rs. {Number(staffWalletReport.totalAmount).toLocaleString()}
            </span>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Developer</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Amount</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Submitted</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {staffWalletReport.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No wallet entries in this period.
                  </td>
                </tr>
              ) : (
                staffWalletReport.entries.map((row) => (
                  <tr key={row.entryId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.developerName}</td>
                    <td className="px-6 py-4 text-gray-600">{row.projectName}</td>
                    <td className="px-6 py-4 font-medium">Rs. {Number(row.amount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600">{row.walletStatus}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(row.submittedAt)}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {row.approvedAt ? formatDate(row.approvedAt) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderMarketingRoiTab = () => {
    if (!marketingRoi) return null;
    return (
      <>
        <p className="text-sm text-gray-600 max-w-3xl mb-4">
          <strong className="font-semibold text-gray-800">Marketing Report</strong> — compare marketing spend against
          profit generated for <strong className="font-semibold text-gray-800">{dateRange.label}</strong>.
          {marketingRoi.profitFormula ? (
            <>
              {' '}
              Net profit: <span className="font-medium">{marketingRoi.profitFormula}</span>.
            </>
          ) : null}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 max-w-5xl">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Marketing spend</span>
            <p className="text-xl font-bold text-red-700 mt-1">
              Rs. {Number(marketingRoi.totalMarketingSpend).toLocaleString()}
            </p>
          </div>
          <div
            className={`rounded-xl p-4 shadow-sm border ${
              (marketingRoi.periodNetProfit ?? 0) >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <span className="text-xs text-gray-600 uppercase tracking-wide">Period net profit</span>
            <p
              className={`text-xl font-bold mt-1 ${
                (marketingRoi.periodNetProfit ?? 0) >= 0 ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              Rs. {Number(marketingRoi.periodNetProfit ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Attributed spend</span>
            <p className="text-xl font-bold text-gray-900 mt-1">
              Rs. {Number(marketingRoi.attributedSpend).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Project value gained</span>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              Rs. {Number(marketingRoi.attributedProjectValue).toLocaleString()}
            </p>
          </div>
          <div
            className={`rounded-xl p-4 shadow-sm border ${
              (marketingRoi.overallRoiPercent ?? 0) >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <span className="text-xs text-gray-600 uppercase tracking-wide">Overall ROI</span>
            <p
              className={`text-xl font-bold mt-1 ${
                (marketingRoi.overallRoiPercent ?? 0) >= 0 ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {marketingRoi.overallRoiPercent != null
                ? `${marketingRoi.overallRoiPercent.toFixed(1)}%`
                : '—'}
            </p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Date</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Description</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Spend</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project value</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {marketingRoi.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No marketing expenses in this period.
                  </td>
                </tr>
              ) : (
                marketingRoi.rows.map((row) => (
                  <tr key={row.expenseId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">{formatDate(row.expenseDate)}</td>
                    <td className="px-6 py-4 text-gray-800">{row.description}</td>
                    <td className="px-6 py-4 font-medium">Rs. {Number(row.marketingSpend).toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600">{row.projectName || '—'}</td>
                    <td className="px-6 py-4 text-gray-800">
                      {row.projectValue > 0 ? `Rs. ${Number(row.projectValue).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {row.roiPercent != null ? (
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            row.roiPercent >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                          }`}
                        >
                          {row.roiPercent.toFixed(1)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      </div>

      {canViewReports ? (
        <>
          <p className="text-sm text-gray-600 max-w-3xl mb-6">
            {canViewFinancial ? (
              <>
                Super Admin view: <strong className="font-semibold text-gray-800">Project Summary</strong>,{' '}
                <strong className="font-semibold text-gray-800">Marketing Report</strong>, and{' '}
                <strong className="font-semibold text-gray-800">Client Statement</strong> plus full financial tabs.
              </>
            ) : (
              <>
                Management view: operational reports (project progress, staff performance, marketing ROI). Company
                financial reports are Super Admin only.
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            {usesDateFilter ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['daily', 'Daily'],
                      ['weekly', 'Weekly'],
                      ['monthly', 'Monthly'],
                      ['custom', 'Custom range'],
                    ] as const
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDatePreset(preset)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        datePreset === preset
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-primary/40'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {datePreset === 'custom' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="text-gray-500 text-sm">to</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                ) : (
                  <span className="inline-flex items-center min-h-[34px] text-sm text-gray-600 whitespace-nowrap">
                    Period: <span className="font-semibold text-gray-900 ml-1">{dateRange.label}</span>
                  </span>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-600">Live snapshot (not filtered by date).</p>
            )}
            {usesProductFilter && productOptions.length > 0 ? (
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="whitespace-nowrap">Group by product</span>
                <select
                  value={groupByProductId}
                  onChange={(e) => setGroupByProductId(e.target.value)}
                  className="min-w-[200px] px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">All products</option>
                  {productOptions.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className={`flex flex-wrap gap-2 ${usesDateFilter ? 'sm:ml-auto' : 'ml-0'}`}>
              <button
                type="button"
                disabled={downloading}
                onClick={() => void exportReport('pdf')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                <FileText size={15} aria-hidden />
                PDF
              </button>
              <button
                type="button"
                disabled={downloading}
                onClick={() => void exportReport('excel')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                <FileSpreadsheet size={15} aria-hidden />
                Excel
              </button>
              <button
                type="button"
                disabled={downloading}
                onClick={() => void exportReport('csv')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={15} aria-hidden />
                CSV
              </button>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {visibleTabGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{group.label}</p>
                <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-0">
                  {group.tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 -mb-px transition-colors ${
                        activeTab === tab
                          ? 'border-primary text-primary bg-orange-50/50'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <section className="mb-10">
            {loading ? (
              <p className="text-gray-500 text-sm">Loading report…</p>
            ) : (
              <>
                {activeTab === 'project-summary' && renderProjectSummaryTab()}
                {activeTab === 'marketing-roi' && renderMarketingRoiTab()}
                {activeTab === 'client-statement' && renderClientStatementTab()}
                {activeTab === 'transactions' && renderTransactionsTab()}
                {activeTab === 'income' && renderIncomeTab()}
                {activeTab === 'expenses' && renderExpenseTab()}
                {activeTab === 'pl' && renderPlTab()}
                {activeTab === 'project-progress' && renderProjectProgressTab()}
                {activeTab === 'staff' && renderStaffTab()}
                {activeTab === 'staff-wallet' && renderStaffWalletTab()}
                {activeTab === 'product-reports' && (
                  <ProductWiseReports periodQuery={rangeQuery} selectedProductId={groupByProductId} />
                )}
              </>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-gray-600 mb-8">
          Reports are available to Super Admin and Management accounts. Developers use Projects and Tasks only.
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Overdue installments</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Client</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">#</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Due date</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Due amount</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Paid</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Overdue days</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {overdueList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No overdue installments.
                  </td>
                </tr>
              ) : (
                overdueList.map((row) => (
                  <tr key={row._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.clientName || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{row.projectName || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{row.installmentNo}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(row.dueDate)}</td>
                    <td className="px-6 py-4 font-medium">Rs. {Number(row.dueAmount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600">Rs. {Number(row.paidAmount).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                        {row.overdueDays}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
