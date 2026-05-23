import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import { useAuth } from '../context/AuthContext';
import styles from './Inquiries.module.css';

type ExpenseCategory = 'MARKETING' | 'STAFF_SALARIES' | 'INFRASTRUCTURE';

interface ExpenseSummary {
  category: ExpenseCategory;
  label: string;
  description: string;
  totalAmount: number;
  entryCount: number;
}

interface ExpenseRow {
  _id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  expenseDate: string;
  source: 'manual' | 'automated';
  developerId?: string;
  developerName?: string;
  projectId?: string;
  projectName?: string;
  projectTotalValue?: number;
  roiPercent?: number | null;
  automationKind?: 'PAYOUT_APPROVAL' | 'PROJECT_OVERHEAD' | 'MONTHLY_PAYROLL';
}

interface ProjectOption {
  _id: string;
  projectName: string;
  totalValue: number;
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
}

interface PayrollPreview {
  period: string;
  year: number;
  month: number;
  rows: {
    developerId: string;
    developerName: string;
    baseSalary: number;
    walletBalance: number;
    totalPay: number;
    alreadyPaid: boolean;
  }[];
  totalPayroll: number;
}

interface DevOption {
  _id: string;
  name: string;
  email?: string;
}

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'STAFF_SALARIES', label: 'Salaries (wallet)' },
  { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
];

function formatRoi(roi: number | null | undefined): string {
  if (roi == null || !Number.isFinite(roi)) return '—';
  const sign = roi >= 0 ? '+' : '';
  return `${sign}${roi.toFixed(0)}%`;
}

export default function Expenses() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'pm';

  const [summary, setSummary] = useState<ExpenseSummary[]>([]);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [developers, setDevelopers] = useState<DevOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [marketingRoi, setMarketingRoi] = useState<MarketingRoiReport | null>(null);
  const [payrollPreview, setPayrollPreview] = useState<PayrollPreview | null>(null);
  const [payrollRunning, setPayrollRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState({
    category: 'MARKETING' as ExpenseCategory,
    amount: '',
    description: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    developerId: '',
    projectId: '',
  });

  const load = async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const listQuery = categoryFilter ? `?category=${categoryFilter}` : '';
      const [sumRes, listRes, usersRes, projectsRes, roiRes, payrollRes] = await Promise.all([
        api.get<ExpenseSummary[]>('/expenses/summary'),
        api.get<ExpenseRow[]>(`/expenses${listQuery}`),
        api.get<{ _id: string; name: string; email?: string; role: string }[]>('/users'),
        api.get<ProjectOption[]>('/projects'),
        api.get<MarketingRoiReport>('/expenses/marketing-roi'),
        api.get<PayrollPreview>('/payroll/preview'),
      ]);
      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
      if (listRes.success && listRes.data) setRows(listRes.data);
      if (usersRes.success && usersRes.data) {
        setDevelopers(
          usersRes.data.filter((u) => u.role === 'employee').map((u) => ({ _id: u._id, name: u.name, email: u.email }))
        );
      }
      if (projectsRes.success && projectsRes.data) setProjects(projectsRes.data);
      if (roiRes.success && roiRes.data) setMarketingRoi(roiRes.data);
      if (payrollRes.success && payrollRes.data) setPayrollPreview(payrollRes.data);
    } catch {
      pushSystemToast('Could not load expenses.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [canManage, categoryFilter]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const grandTotal = summary.reduce((s, c) => s + Number(c.totalAmount), 0);

  const automationLabel = (r: ExpenseRow) => {
    if (r.automationKind === 'MONTHLY_PAYROLL') return 'Monthly payroll';
    if (r.automationKind === 'PAYOUT_APPROVAL') return 'Wallet payout';
    if (r.automationKind === 'PROJECT_OVERHEAD') return 'Project overhead';
    return 'Automated';
  };

  const runMonthlyPayroll = async () => {
    if (!payrollPreview) return;
    if (
      !confirm(
        `Run payroll for ${payrollPreview.period}? Total Rs. ${payrollPreview.totalPayroll.toLocaleString()} will be paid and logged as salary expenses.`
      )
    ) {
      return;
    }
    setPayrollRunning(true);
    try {
      const res = await api.post<{ totalPaid: number; paidCount: number }>('/payroll/run', {
        year: payrollPreview.year,
        month: payrollPreview.month,
      });
      if (res.success && res.data) {
        pushSystemToast(
          `Payroll complete — ${res.data.paidCount} paid, Rs. ${Number(res.data.totalPaid).toLocaleString()} logged.`,
          'success'
        );
        await load();
      } else {
        pushSystemToast(res.error?.message || 'Payroll run failed.', 'error');
      }
    } catch {
      pushSystemToast('Payroll run failed.', 'error');
    } finally {
      setPayrollRunning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      pushSystemToast('Enter a valid amount greater than zero.', 'warning');
      return;
    }
    if (!form.description.trim()) {
      pushSystemToast('Description is required.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<ExpenseRow>('/expenses', {
        category: form.category,
        amount,
        description: form.description.trim(),
        expenseDate: new Date(form.expenseDate).toISOString(),
        ...(form.category === 'STAFF_SALARIES' && form.developerId
          ? { developerId: form.developerId }
          : {}),
        ...(form.category === 'MARKETING' && form.projectId ? { projectId: form.projectId } : {}),
      });
      if (res.success && res.data) {
        pushSystemToast('Expense logged.', 'success');
        setForm((f) => ({ ...f, amount: '', description: '', developerId: '', projectId: '' }));
        await load();
      } else {
        pushSystemToast(res.error?.message || 'Could not save expense.', 'error');
      }
    } catch (err) {
      pushSystemToast(err instanceof Error ? err.message : 'Could not save expense.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManage) {
    return (
      <div className={`${styles.page} font-sans`}>
        <div className={styles.headerRow}>
          <h1 className="text-2xl font-bold text-gray-900">Expense management</h1>
        </div>
        <p className="text-gray-600">You do not have access to this module.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-orange-50 text-primary">
            <TrendingDown size={28} aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expense management</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl">
              Manual logging for Marketing, Salaries, and Infrastructure. Link marketing spend to a project to see ROI
              (e.g. Rs. 10,000 on Facebook Ads → Rs. 100,000 project = +900% ROI). Salaries also post automatically
              when a developer wallet payout is approved; infrastructure posts when project overhead expenses increase.
            </p>
          </div>
        </div>
      </div>

      {payrollPreview ? (
        <div className="mb-8 p-4 bg-white border border-emerald-200 rounded-xl shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-emerald-900">Monthly payroll — {payrollPreview.period}</h2>
              <p className="text-xs text-gray-600 mt-1">
                Salary = base pay + wallet (approved task earnings). Paying clears each developer&apos;s wallet and
                logs a salary expense in accounts.
              </p>
            </div>
            <button
              type="button"
              disabled={payrollRunning || payrollPreview.totalPayroll <= 0}
              onClick={() => void runMonthlyPayroll()}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-700 text-white hover:opacity-90 disabled:opacity-50"
            >
              {payrollRunning ? 'Processing…' : 'Run month-end payroll'}
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="px-4 py-3 text-orange-500 font-bold text-xs">Developer</th>
                  <th className="px-4 py-3 text-orange-500 font-bold text-xs text-right">Base</th>
                  <th className="px-4 py-3 text-orange-500 font-bold text-xs text-right">Wallet</th>
                  <th className="px-4 py-3 text-orange-500 font-bold text-xs text-right">Total pay</th>
                  <th className="px-4 py-3 text-orange-500 font-bold text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {payrollPreview.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500 text-sm">
                      No active developers.
                    </td>
                  </tr>
                ) : (
                  payrollPreview.rows.map((row) => (
                    <tr key={row.developerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.developerName}</td>
                      <td className="px-4 py-3 text-sm text-right">Rs. {row.baseSalary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right">Rs. {row.walletBalance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        Rs. {row.totalPay.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.alreadyPaid ? (
                          <span className="text-gray-500">Paid this period</span>
                        ) : row.totalPay > 0 ? (
                          <span className="text-emerald-700 font-medium">Ready</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-3">
            Total due: Rs. {payrollPreview.totalPayroll.toLocaleString()}
          </p>
        </div>
      ) : null}

      <h2 className="text-sm font-semibold text-gray-800 mb-2">Expense categories</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {summary.map((cat) => (
          <div
            key={cat.category}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-2"
          >
            <span className="text-sm font-bold text-primary">{cat.label}</span>
            <p className="text-xs text-gray-600 leading-relaxed flex-1">{cat.description}</p>
            <div className="pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Logged total</span>
              <p className="text-lg font-bold text-gray-900">Rs. {Number(cat.totalAmount).toLocaleString()}</p>
              <span className="text-xs text-gray-500">{cat.entryCount} entr{cat.entryCount === 1 ? 'y' : 'ies'}</span>
            </div>
          </div>
        ))}
      </div>

      {marketingRoi ? (
        <div className="mb-8 p-4 bg-white border border-violet-200 rounded-xl shadow-sm">
          <h2 className="text-sm font-semibold text-violet-900 mb-1">Marketing ROI</h2>
          <p className="text-xs text-gray-600 mb-4">
            ROI = (Project value − Marketing spend) ÷ Marketing spend. Link each ad/campaign to the project it won.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500 uppercase">Marketing spend</div>
              <div className="text-lg font-bold text-gray-900">
                Rs. {marketingRoi.totalMarketingSpend.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs text-gray-500 uppercase">Attributed project value</div>
              <div className="text-lg font-bold text-gray-900">
                Rs. {marketingRoi.attributedProjectValue.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3">
              <div className="text-xs text-violet-800 uppercase">Overall ROI (linked campaigns)</div>
              <div className="text-lg font-bold text-violet-900">{formatRoi(marketingRoi.overallRoiPercent)}</div>
            </div>
          </div>
          {marketingRoi.rows.some((r) => r.projectId) ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-orange-500 font-bold text-xs">Campaign</th>
                    <th className="px-4 py-3 text-orange-500 font-bold text-xs">Project</th>
                    <th className="px-4 py-3 text-orange-500 font-bold text-xs text-right">Spend</th>
                    <th className="px-4 py-3 text-orange-500 font-bold text-xs text-right">Project value</th>
                    <th className="px-4 py-3 text-orange-500 font-bold text-xs text-right">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {marketingRoi.rows
                    .filter((r) => r.projectId)
                    .map((r) => (
                      <tr key={r.expenseId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{r.description}</td>
                        <td className="px-4 py-3 text-sm">
                          {r.projectId ? (
                            <Link to={`/projects/${r.projectId}`} className="text-orange-600 hover:underline font-medium">
                              {r.projectName || 'Project'}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">Rs. {r.marketingSpend.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right">Rs. {r.projectValue.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-violet-800">
                          {formatRoi(r.roiPercent)}
                          {r.returnMultiple != null ? (
                            <span className="block text-xs font-normal text-gray-500">
                              {r.returnMultiple.toFixed(1)}× return
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Log a marketing expense and link it to a project to see ROI here.</p>
          )}
        </div>
      ) : null}

      <div className="mb-8 p-4 bg-white border border-gray-200 rounded-xl shadow-sm max-w-xl">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Log manual expense</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as ExpenseCategory,
                  developerId: e.target.value === 'STAFF_SALARIES' ? f.developerId : '',
                  projectId: e.target.value === 'MARKETING' ? f.projectId : '',
                }))
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {form.category === 'STAFF_SALARIES' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Link developer (wallet) — optional</label>
              <select
                value={form.developerId}
                onChange={(e) => setForm((f) => ({ ...f, developerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="">No developer link</option>
                {developers.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {form.category === 'MARKETING' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Link project (for ROI) — optional</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="">No project link</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.projectName} — Rs. {Number(p.totalValue).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (Rs.)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary resize-y"
              placeholder={
                form.category === 'MARKETING'
                  ? 'e.g. Facebook Ads — March campaign'
                  : form.category === 'STAFF_SALARIES'
                    ? 'e.g. Monthly salary — March'
                    : 'e.g. AWS hosting — April'
              }
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save expense'}
          </button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Total outflows</span>
        <span className="text-xl font-bold text-gray-900">Rs. {grandTotal.toLocaleString()}</span>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="ml-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-2">Expense ledger</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Category</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Source</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Description</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project / ROI</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No expenses yet. Log manually above, approve a wallet payout (salaries), or increase project
                  overhead expenses (infrastructure).
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">{formatDate(r.expenseDate)}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {summary.find((s) => s.category === r.category)?.label ?? r.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit px-2 py-0.5 text-xs font-semibold rounded-full ${
                          r.source === 'automated' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {r.source === 'automated' ? automationLabel(r) : 'Manual'}
                      </span>
                      {r.developerName ? (
                        <span className="text-xs text-emerald-800">Wallet · {r.developerName}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 text-sm max-w-md">{r.description}</td>
                  <td className="px-6 py-4 text-sm">
                    {r.category === 'MARKETING' && r.projectId ? (
                      <div className="flex flex-col gap-0.5">
                        <Link to={`/projects/${r.projectId}`} className="text-orange-600 hover:underline font-medium">
                          {r.projectName || 'Project'}
                        </Link>
                        <span className="text-violet-800 font-semibold">{formatRoi(r.roiPercent)}</span>
                      </div>
                    ) : r.category === 'MARKETING' ? (
                      <span className="text-gray-400 text-xs">Link a project for ROI</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">Rs. {Number(r.amount).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
