import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Download } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import { useAuth } from '../context/AuthContext';
import styles from './Inquiries.module.css';

type LedgerKind = 'all' | 'income' | 'expense';

interface FinanceLedgerRow {
  _id: string;
  kind: 'income' | 'expense';
  date: string;
  amount: number;
  description: string;
  categoryLabel: string;
  referenceId: string;
  referenceType: 'invoice' | 'expense';
  clientName?: string;
  invoiceNumber?: string;
  invoiceType?: string;
  expenseCategory?: string;
  expenseSource?: 'manual' | 'automated';
}

interface FinanceLedgerResult {
  rows: FinanceLedgerRow[];
  sumIncome: number;
  sumExpense: number;
  currentBalance: number;
  from?: string;
  to?: string;
}

function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export default function Transactions() {
  const { user } = useAuth();
  const canView = user?.role === 'owner';

  const now = new Date();
  const defaultRange = monthBounds(now.getFullYear(), now.getMonth() + 1);

  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [kindFilter, setKindFilter] = useState<LedgerKind>('all');
  const [ledger, setLedger] = useState<FinanceLedgerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        params.set('to', end.toISOString());
      }
      if (kindFilter !== 'all') params.set('kind', kindFilter);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<FinanceLedgerResult>(`/reports/finance-ledger${q}`);
      if (res.success && res.data) setLedger(res.data);
      else setLedger(null);
    } finally {
      setLoading(false);
    }
  }, [canView, fromDate, toDate, kindFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setThisMonth = () => {
    const r = monthBounds(now.getFullYear(), now.getMonth() + 1);
    setFromDate(r.from);
    setToDate(r.to);
  };

  const setLastMonth = () => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const r = monthBounds(d.getFullYear(), d.getMonth() + 1);
    setFromDate(r.from);
    setToDate(r.to);
  };

  const setAllTime = () => {
    setFromDate('');
    setToDate('');
  };

  const downloadProfitLoss = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        params.set('to', end.toISOString());
      }
      if (!fromDate && !toDate) {
        const r = monthBounds(now.getFullYear(), now.getMonth() + 1);
        params.set('from', new Date(r.from).toISOString());
        params.set('to', new Date(r.to + 'T23:59:59').toISOString());
      }
      const q = params.toString() ? `?${params.toString()}` : '';
      await api.download(`/reports/monthly-profit-loss/download${q}`, 'profit-loss.csv');
    } catch (err) {
      pushSystemToast(err instanceof Error ? err.message : 'Download failed.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (!canView) {
    return (
      <div className={`${styles.page} font-sans`}>
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-600 mt-2">You do not have access to this module.</p>
      </div>
    );
  }

  const balance = ledger?.currentBalance ?? 0;

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={`${styles.headerRow} flex flex-wrap items-start justify-between gap-4`}>
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 rounded-lg bg-orange-50 text-primary">
            <ArrowLeftRight size={28} aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl">
              Self-accounting master ledger — income when invoices are paid; expenses when payouts are assigned,
              marketing is logged, or infrastructure costs are recorded. Period balance = SUM(Income) − SUM(Expense).
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={downloading}
          onClick={() => void downloadProfitLoss()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={16} aria-hidden />
          {downloading ? 'Exporting…' : 'Download P/L report'}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-6 p-4 bg-white border border-gray-200 rounded-xl">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as LedgerKind)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="all">All</option>
            <option value="income">Income only</option>
            <option value="expense">Expense only</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={setThisMonth}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            This month
          </button>
          <button
            type="button"
            onClick={setLastMonth}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Last month
          </button>
          <button
            type="button"
            onClick={setAllTime}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            All time
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="text-xs font-semibold text-emerald-900 uppercase">Total income</div>
          <div className="text-xl font-bold text-emerald-800 mt-1">
            Rs. {Number(ledger?.sumIncome ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-emerald-800/80 mt-1">Paid invoices in range</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
          <div className="text-xs font-semibold text-red-900 uppercase">Total expenses</div>
          <div className="text-xl font-bold text-red-800 mt-1">
            Rs. {Number(ledger?.sumExpense ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-red-800/80 mt-1">Marketing, payouts, overheads</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            balance >= 0 ? 'border-blue-200 bg-blue-50/50' : 'border-amber-200 bg-amber-50/50'
          }`}
        >
          <div className="text-xs font-semibold text-gray-800 uppercase">Period profit / loss</div>
          <div className={`text-xl font-bold mt-1 ${balance >= 0 ? 'text-blue-900' : 'text-amber-900'}`}>
            Rs. {balance.toLocaleString()}
          </div>
          <p className="text-xs text-gray-600 mt-1">Current balance = Income − Expense</p>
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
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Reference</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : !ledger || ledger.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No transactions in this period. Mark invoices as paid or log expenses to see entries here.
                </td>
              </tr>
            ) : (
              ledger.rows.map((row) => (
                <tr key={row._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600 text-sm">{formatDate(row.date)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        row.kind === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {row.kind === 'income' ? 'Income' : 'Expense'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">{row.categoryLabel}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                    {row.description}
                    {row.clientName ? (
                      <span className="block text-xs text-gray-500 mt-0.5">{row.clientName}</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {row.referenceType === 'invoice' && row.invoiceNumber ? (
                      <Link to="/invoices" className="text-orange-600 hover:underline font-medium">
                        {row.invoiceNumber}
                      </Link>
                    ) : row.referenceType === 'expense' ? (
                      <Link to="/expenses" className="text-orange-600 hover:underline font-medium">
                        Expense
                        {row.expenseSource === 'automated' ? ' (auto)' : ''}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-semibold ${
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
    </div>
  );
}
