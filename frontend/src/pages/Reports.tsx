import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './Inquiries.module.css';

interface MonthlyCollection {
  year: number;
  month: number;
  totalCollected: number;
  transactionCount: number;
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

type IncomeInvoiceType = 'ADVANCE_PAYMENT' | 'MONTHLY_INSTALLMENT' | 'BALANCE_PAYMENT';

interface IncomeCategorySummary {
  invoiceType: IncomeInvoiceType;
  label: string;
  description: string;
  totalAmount: number;
  invoiceCount: number;
}

interface IncomeTrackingRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientName?: string;
  amount: number;
  invoiceType: IncomeInvoiceType;
}

interface IncomeTrackingResult {
  categories: IncomeCategorySummary[];
  entries: IncomeTrackingRow[];
  grandTotal: number;
}

const INCOME_TYPE_ORDER: IncomeInvoiceType[] = ['ADVANCE_PAYMENT', 'MONTHLY_INSTALLMENT', 'BALANCE_PAYMENT'];

const incomeTypeShortLabel = (t: IncomeInvoiceType): string => {
  switch (t) {
    case 'ADVANCE_PAYMENT':
      return 'Advance';
    case 'MONTHLY_INSTALLMENT':
      return 'Monthly installment';
    case 'BALANCE_PAYMENT':
      return 'Balance';
    default:
      return t;
  }
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthly, setMonthly] = useState<MonthlyCollection | null>(null);
  const [overdueList, setOverdueList] = useState<OverdueRow[]>([]);
  const [incomeTracking, setIncomeTracking] = useState<IncomeTrackingResult | null>(null);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIncomeLoading(true);
    api.get<IncomeTrackingResult>('/reports/income-tracking').then((res) => {
      if (res.success && res.data) setIncomeTracking(res.data);
      setIncomeLoading(false);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get<MonthlyCollection>(`/reports/monthly-collection?year=${year}&month=${month}`).then((res) => {
      if (res.success && res.data) setMonthly(res.data);
      setLoading(false);
    });
  }, [year, month]);

  useEffect(() => {
    api.get<OverdueRow[]>('/reports/overdue-list').then((res) => {
      if (res.success && res.data) setOverdueList(res.data);
    });
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Income tracking</h2>
        <p className="text-sm text-gray-600 max-w-3xl mb-2">
          The system automatically identifies and categorizes all incoming funds to ensure organized financial
          management. Amounts below are from <strong className="font-semibold text-gray-800">paid invoices</strong> only.
        </p>
        <p className="text-xs text-gray-500 max-w-3xl mb-4 border-l-2 border-primary pl-3">
          <span className="font-semibold text-gray-700">System logic:</span> Incoming funds are categorized into
          Advance, Monthly installments, or Final balance based on the invoice type for each transaction (proposal
          advance vs. installment plan position).
        </p>

        <h3 className="text-sm font-semibold text-gray-800 mb-2">Income categories</h3>
        {incomeLoading ? (
          <p className="text-gray-500 text-sm">Loading income summary…</p>
        ) : incomeTracking ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[...incomeTracking.categories]
                .sort(
                  (a, b) => INCOME_TYPE_ORDER.indexOf(a.invoiceType) - INCOME_TYPE_ORDER.indexOf(b.invoiceType)
                )
                .map((cat) => (
                  <div
                    key={cat.invoiceType}
                    className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-2"
                  >
                    <span className="text-sm font-bold text-primary">{cat.label}</span>
                    <p className="text-xs text-gray-600 leading-relaxed flex-1">{cat.description}</p>
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Paid total</span>
                      <p className="text-lg font-bold text-gray-900">Rs. {Number(cat.totalAmount).toLocaleString()}</p>
                      <span className="text-xs text-gray-500">{cat.invoiceCount} invoice(s)</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium text-gray-700">Realized income (all paid invoices)</span>
              <span className="text-xl font-bold text-gray-900">
                Rs. {Number(incomeTracking.grandTotal).toLocaleString()}
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
                  {incomeTracking.entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No paid invoices yet.
                      </td>
                    </tr>
                  ) : (
                    incomeTracking.entries.map((row: IncomeTrackingRow) => (
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
        ) : null}
      </section>

      <div className={styles.filtersRow}>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value, 10))}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Monthly collection</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : monthly ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-sm text-gray-500 uppercase tracking-wide">Collected in {MONTHS[month - 1]} {year}</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">Rs. {Number(monthly.totalCollected).toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <span className="text-sm text-gray-500 uppercase tracking-wide">Transactions</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{monthly.transactionCount}</p>
            </div>
          </div>
        ) : null}
      </section>

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
                      <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-semibold">{row.overdueDays}</span>
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
