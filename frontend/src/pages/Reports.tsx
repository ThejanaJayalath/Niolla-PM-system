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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthly, setMonthly] = useState<MonthlyCollection | null>(null);
  const [overdueList, setOverdueList] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(false);

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
