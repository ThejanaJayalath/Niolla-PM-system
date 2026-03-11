import { useState, useEffect } from 'react';
import { Trash2, CheckCircle } from 'lucide-react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import RecordPaymentModal from '../components/RecordPaymentModal';
import styles from './Inquiries.module.css';

interface Installment {
  _id: string;
  planId: string;
  projectName?: string;
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  paidDate?: string;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  overdueDays: number;
}

interface PaymentPlanOption {
  _id: string;
  projectName?: string;
}

export default function Installments() {
  const navigate = useNavigate();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [plans, setPlans] = useState<PaymentPlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInstId, setPaymentInstId] = useState<string | undefined>(undefined);

  const loadInstallments = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('projectId');

      const queryParams = new URLSearchParams();
      if (planFilter) queryParams.append('planId', planFilter);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (projectId) queryParams.append('projectId', projectId);

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const res = await api.get<Installment[]>(`/installments${queryString}`);
      if (res.success && res.data) setInstallments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const res = await api.get<PaymentPlanOption[]>('/payment-plans');
      if (res.success && res.data) setPlans(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadInstallments();
  }, [planFilter, statusFilter]);

  const handleDelete = async () => {
    const id = deleteId;
    if (!id) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/installments/${id}`);
      if (res?.success === false) {
        alert(res.error?.message || 'Failed to delete installment');
      } else {
        await loadInstallments();
        setDeleteId(null);
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred while deleting');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const statusClass = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-amber-100 text-amber-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;

  // When showing current/pending: only show the NEXT (lowest installmentNo) per plan.
  // For any other filter, show all matching installments.
  const displayedInstallments = (() => {
    if (statusFilter !== 'pending') return installments;
    // Group by planId, pick the one with the smallest installmentNo
    const planMap = new Map<string, Installment>();
    for (const inst of installments) {
      const existing = planMap.get(inst.planId);
      if (!existing || inst.installmentNo < existing.installmentNo) {
        planMap.set(inst.planId, inst);
      }
    }
    return Array.from(planMap.values());
  })();

  const totalPages = Math.ceil(displayedInstallments.length / rowsPerPage);
  const paginated = displayedInstallments.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Installments</h1>
      </div>

      <div className={styles.filtersRow}>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p._id} value={p._id}>
              {p.projectName || p._id}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project / Plan</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">#</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Due Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Due Amount</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Paid Amount</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Overdue Days</th>
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
            ) : installments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No installments yet. Create a payment plan and generate installments from the Payment Plans page.
                </td>
              </tr>
            ) : (
              <>
                {paginated.map((inst) => (
                  <tr key={inst._id}
                    className="hover:bg-orange-50 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/installments/${inst.planId}`)}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{inst.projectName || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{inst.installmentNo}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(inst.dueDate)}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      Rs. {Number(inst.dueAmount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      Rs. {Number(inst.paidAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusClass(inst.status)}`}>
                        {inst.status.charAt(0).toUpperCase() + inst.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{inst.overdueDays ?? 0}</td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-center items-center gap-2">
                        {inst.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentInstId(inst._id);
                              setPaymentModalOpen(true);
                            }}
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                            title="Mark Paid"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteId(inst._id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
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
              {displayedInstallments.length === 0
                ? '0-0 of 0'
                : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, displayedInstallments.length)} of ${displayedInstallments.length}`}
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

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Installment"
        message="Are you sure you want to delete this installment?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
        isLoading={deleting}
      />

      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => {
          setPaymentModalOpen(false);
          loadInstallments();
        }}
        installments={installments}
        initialInstallmentId={paymentInstId}
      />
    </div>
  );
}
