import { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import { useAuth } from '../context/AuthContext';
import styles from './Inquiries.module.css';

type ExpenseCategory = 'MARKETING' | 'STAFF_SALARIES' | 'OPERATIONAL';

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
  projectId?: string;
  automationKind?: string;
}

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'MARKETING', label: 'Marketing expenses' },
  { value: 'STAFF_SALARIES', label: 'Staff salaries' },
  { value: 'OPERATIONAL', label: 'Operational costs' },
];

export default function Expenses() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'pm';

  const [summary, setSummary] = useState<ExpenseSummary[]>([]);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: 'OPERATIONAL' as ExpenseCategory,
    amount: '',
    description: '',
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.all([
        api.get<ExpenseSummary[]>('/expenses/summary'),
        api.get<ExpenseRow[]>('/expenses'),
      ]);
      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
      if (listRes.success && listRes.data) setRows(listRes.data);
    } catch {
      pushSystemToast('Could not load expenses.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [canManage]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const grandTotal = summary.reduce((s, c) => s + Number(c.totalAmount), 0);

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
      });
      if (res.success && res.data) {
        pushSystemToast('Expense logged.', 'success');
        setForm((f) => ({ ...f, amount: '', description: '' }));
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
              This module tracks every rupee leaving the company to maintain financial transparency and budget control.
            </p>
          </div>
        </div>
      </div>

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

      <p className="text-xs text-gray-500 max-w-3xl mb-6 border-l-2 border-primary pl-3">
        <span className="font-semibold text-gray-700">System logic:</span> The system supports both manual and
        automated expense logging. It categorizes outflows into Marketing, Salaries (integrated with the Wallet system
        when an admin approves a developer payout), and general Infrastructure / operational costs.
      </p>

      <div className="mb-8 p-4 bg-white border border-gray-200 rounded-xl shadow-sm max-w-xl">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Log manual expense</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
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
              placeholder="e.g. Google Ads campaign — March"
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

      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium text-gray-700">Total outflows (all categories)</span>
        <span className="text-xl font-bold text-gray-900">Rs. {grandTotal.toLocaleString()}</span>
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
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No expenses logged yet. Add a manual entry above, or approve a developer payout to record salary
                  outflow automatically.
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
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        r.source === 'automated' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {r.source === 'automated' ? 'Automated' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700 text-sm max-w-md">{r.description}</td>
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
