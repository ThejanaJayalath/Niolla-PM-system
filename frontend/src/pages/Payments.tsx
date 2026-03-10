import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api/client';
import RecordPaymentModal, { InstallmentOption } from '../components/RecordPaymentModal';
import styles from './Inquiries.module.css';

interface PaymentTransaction {
  _id: string;
  installmentId: string;
  clientId: string;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
  paymentDate: string;
  recordedBy: string;
  projectName?: string;
  installmentNo?: number;
  clientName?: string;
  recordedByName?: string;
}

interface CustomerOption {
  _id: string;
  name?: string;
  companyName?: string;
}

export default function Payments() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [installments, setInstallments] = useState<InstallmentOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);

  const loadTransactions = async () => {
    try {
      const params = new URLSearchParams();
      if (clientFilter) params.append('clientId', clientFilter);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<PaymentTransaction[]>(`/payments${queryString}`);
      if (res.success && res.data) setTransactions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadInstallments = async () => {
    try {
      const res = await api.get<InstallmentOption[]>('/installments');
      if (res.success && res.data) setInstallments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.get<CustomerOption[]>('/customers');
      if (res.success && res.data) setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInstallments();
    loadCustomers();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadTransactions();
  }, [clientFilter]);

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const methodLabel = (m: string) => {
    const map: Record<string, string> = { cash: 'Cash', bank: 'Bank', card: 'Card', online: 'Online' };
    return map[m] || m;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;
  const totalPages = Math.ceil(transactions.length / rowsPerPage);
  const paginated = transactions.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Record Payment
        </button>
      </div>

      <div className={styles.filtersRow}>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All clients</option>
          {customers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.companyName || c.name || c._id}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Client</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project / Installment</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Amount</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Method</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Reference</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Recorded By</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No payments yet. Record a payment against an active project installment.
                </td>
              </tr>
            ) : (
              <>
                {paginated.map((tx) => (
                  <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">{formatDate(tx.paymentDate)}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{tx.clientName || tx.clientId}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {tx.projectName || '—'} {tx.installmentNo != null ? `#${tx.installmentNo}` : ''}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Rs. {Number(tx.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{methodLabel(tx.paymentMethod)}</td>
                    <td className="px-6 py-4 text-gray-600">{tx.referenceNo || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{tx.recordedByName || tx.recordedBy}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, rowsPerPage - paginated.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="h-[60px]">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <td key={i} className="px-6 py-4">&nbsp;</td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>

        <div className="px-6 py-3 bg-[#f9fafb] border-t border-[#fed7aa] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows Per Page:</span>
            <span>{rowsPerPage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              {transactions.length === 0
                ? '0-0 of 0'
                : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, transactions.length)} of ${transactions.length}`}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      <RecordPaymentModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          loadTransactions();
          loadInstallments();
        }}
        installments={installments}
      />
    </div>
  );
}
