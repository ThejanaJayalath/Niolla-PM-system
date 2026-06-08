import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Copy, FileDown, Mail, Send, X } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import styles from './Inquiries.module.css';

interface Invoice {
  _id: string;
  transactionId?: string;
  inquiryId?: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  originalAmount?: number;
  taxAmount?: number;
  discountAmt?: number;
  campaignName?: string;
  status: 'draft' | 'sent' | 'paid' | 'pending';
  clientName?: string;
  emailedAt?: string;
  description?: string;
  companyName?: string;
  sourceType?: 'PAYMENT' | 'PROPOSAL_ADVANCE';
  invoiceType?: 'ADVANCE_PAYMENT' | 'MONTHLY_INSTALLMENT' | 'BALANCE_PAYMENT';
}

interface CustomerOption {
  _id: string;
  name?: string;
  companyName?: string;
}

interface NotifyCustomerResponse {
  pdfUrl: string;
  publicApiBaseUrl: string;
  queuedEmail: boolean;
  queuedSms: boolean;
  invoice: Invoice;
}

export default function Invoices() {
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [notifyModal, setNotifyModal] = useState<{ pdfUrl: string; invoiceNumber: string; queuedEmail: boolean; queuedSms: boolean } | null>(null);

  const loadInvoices = async () => {
    try {
      const params = new URLSearchParams();
      if (clientFilter) params.append('clientId', clientFilter);
      if (statusFilter) params.append('status', statusFilter);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<Invoice[]>(`/invoices${queryString}`);
      if (res.success && res.data) setInvoices(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    loadCustomers();
  }, []);

  useEffect(() => {
    const st = searchParams.get('status');
    if (st && ['draft', 'sent', 'paid', 'pending'].includes(st)) {
      setStatusFilter(st);
    }
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    loadInvoices();
  }, [clientFilter, statusFilter]);

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const handleDownloadPdf = async (inv: Invoice) => {
    setDownloadingId(inv._id);
    try {
      await api.download(`/invoices/${inv._id}/pdf`, `invoice-${inv.invoiceNumber}.pdf`);
    } catch (err) {
      console.error(err);
      pushSystemToast(err instanceof Error ? err.message : 'Failed to download invoice PDF', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSendEmail = async (inv: Invoice) => {
    setSendingId(inv._id);
    try {
      const res = await api.patch<Invoice>(`/invoices/${inv._id}/send-email`, {});
      if (res?.success && res.data) setInvoices((prev) => prev.map((i) => (i._id === inv._id ? { ...i, emailedAt: res.data!.emailedAt } : i)));
    } catch (err) {
      console.error(err);
    } finally {
      setSendingId(null);
    }
  };

  const handleNotifyCustomer = async (inv: Invoice) => {
    setNotifyingId(inv._id);
    try {
      const res = await api.post<NotifyCustomerResponse>(`/invoices/${inv._id}/notify-customer`, {});
      if (res.success && res.data) {
        setNotifyModal({
          pdfUrl: res.data.pdfUrl,
          invoiceNumber: res.data.invoice.invoiceNumber,
          queuedEmail: res.data.queuedEmail,
          queuedSms: res.data.queuedSms,
        });
        await loadInvoices();
        const channels = [res.data.queuedEmail && 'email', res.data.queuedSms && 'SMS'].filter(Boolean).join(' & ');
        pushSystemToast(
          channels
            ? `Customer notification queued (${channels}) with a secure PDF download link.`
            : 'Notification queued.',
          'success'
        );
      } else {
        pushSystemToast(res.error?.message || 'Could not queue customer notification.', 'error');
      }
    } catch (err) {
      console.error(err);
      pushSystemToast(err instanceof Error ? err.message : 'Could not queue customer notification.', 'error');
    } finally {
      setNotifyingId(null);
    }
  };

  const handleMarkPaid = async (inv: Invoice) => {
    setMarkingPaidId(inv._id);
    try {
      const res = await api.patch<Invoice>(`/invoices/${inv._id}`, { status: 'paid' });
      if (res.success && res.data) {
        setInvoices((prev) => prev.map((i) => (i._id === inv._id ? { ...i, ...res.data! } : i)));
        pushSystemToast('Invoice marked paid. Client notified: payment received and remaining balance.', 'success');
      } else {
        pushSystemToast(res.error?.message || 'Could not mark invoice paid.', 'error');
      }
    } catch (err) {
      console.error(err);
      pushSystemToast(err instanceof Error ? err.message : 'Could not mark invoice paid.', 'error');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const copyPdfLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      pushSystemToast('Download link copied to clipboard.', 'success');
    } catch {
      pushSystemToast('Could not copy link.', 'warning');
    }
  };

  const invoiceTypeLabel = (inv: Invoice): string => {
    if (inv.invoiceType === 'ADVANCE_PAYMENT') return 'Advance';
    if (inv.invoiceType === 'BALANCE_PAYMENT') return 'Balance';
    if (inv.invoiceType === 'MONTHLY_INSTALLMENT') return 'Monthly';
    if (inv.sourceType === 'PROPOSAL_ADVANCE') return 'Advance';
    if (inv.sourceType === 'PAYMENT') return 'Installment / balance';
    return '—';
  };

  const statusClass = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;
  const totalPages = Math.ceil(invoices.length / rowsPerPage);
  const paginated = invoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Invoice No</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Client</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Income type</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Pricing</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Emailed</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm !text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No invoices yet. Invoices are created automatically when you record a payment.
                </td>
              </tr>
            ) : (
              <>
                {paginated.map((inv) => (
                  <tr key={inv._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <Link
                        to={`/customer/${inv.clientId}`}
                        className="text-orange-600 hover:text-orange-700 font-semibold hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <Link
                        to={`/customer/${inv.clientId}`}
                        className="text-gray-700 hover:text-orange-600 hover:underline"
                      >
                        {inv.clientName || inv.clientId}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-6 py-4 text-gray-700 text-sm">{invoiceTypeLabel(inv)}</td>
                    <td className="px-6 py-4 text-sm">
                      {(inv.discountAmt ?? 0) > 0 && (inv.originalAmount ?? 0) > 0 ? (
                        <div className="space-y-0.5">
                          <div className="text-gray-500 line-through text-xs">
                            Rs. {Number(inv.originalAmount).toLocaleString()}
                          </div>
                          <div className="text-red-600 text-xs">
                            − Rs. {Number(inv.discountAmt).toLocaleString()}
                            {inv.campaignName ? ` (${inv.campaignName})` : ''}
                          </div>
                          <div className="font-semibold text-emerald-800">
                            Rs. {Number(inv.totalAmount).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-900">
                          Rs. {Number(inv.totalAmount).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusClass(inv.status)}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{inv.emailedAt ? formatDate(inv.emailedAt) : '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center flex-wrap gap-1.5">
                        {(inv.status === 'pending' || inv.status === 'sent' || inv.status === 'draft') &&
                        inv.sourceType === 'PROPOSAL_ADVANCE' ? (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(inv)}
                            disabled={markingPaidId === inv._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-green-600 hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50"
                            title="Record advance received (updates business receipts; notifies client)"
                          >
                            <CheckCircle size={14} aria-hidden />
                            {markingPaidId === inv._id ? 'Saving...' : 'Mark paid'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleNotifyCustomer(inv)}
                          disabled={notifyingId === inv._id}
                          className="p-2 text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Email & SMS: invoice with PDF download link"
                          aria-label="Notify customer with invoice PDF link"
                        >
                          <Send size={18} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendEmail(inv)}
                          disabled={sendingId === inv._id}
                          className="p-2 text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Mark as sent by email (timestamp only)"
                        >
                          <Mail size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv)}
                          disabled={downloadingId === inv._id}
                          className="p-2 text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Download PDF"
                        >
                          <FileDown size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, rowsPerPage - paginated.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="h-[60px]">
                    {Array.from({ length: 8 }).map((_, i) => (
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
              {invoices.length === 0
                ? '0-0 of 0'
                : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, invoices.length)} of ${invoices.length}`}
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

      {notifyModal ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true" aria-labelledby="notify-modal-title">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-orange-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 id="notify-modal-title" className="text-lg font-semibold text-gray-900">
                Invoice sent to customer
              </h2>
              <button
                type="button"
                onClick={() => setNotifyModal(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-800">{notifyModal.invoiceNumber}</span>
                {' — '}
                Queued {notifyModal.queuedEmail && notifyModal.queuedSms
                  ? 'email and SMS'
                  : notifyModal.queuedEmail
                    ? 'email'
                    : 'SMS'}{' '}
                with the same secure PDF link the customer can open without logging in.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Public download link (shareable)</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 font-mono"
                    value={notifyModal.pdfUrl}
                  />
                  <button
                    type="button"
                    onClick={() => copyPdfLink(notifyModal.pdfUrl)}
                    className="shrink-0 px-3 py-2 bg-primary text-white rounded-lg hover:opacity-90 flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Copy size={14} />
                    Copy
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Links expire after 30 days. Set <code className="bg-gray-100 px-1 rounded">PUBLIC_API_BASE_URL</code> on the server so SMS/email point to your live API.
              </p>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setNotifyModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
