import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Tag,
  Wrench,
  CheckCircle2,
  Users,
  CreditCard,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import { useAuth } from '../context/AuthContext';
import CreateUpdateTicketModal from '../components/CreateUpdateTicketModal';
import styles from './Inquiries.module.css';

type UpdateTicketStatus =
  | 'REQUESTED'
  | 'PRICED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

interface UpdateTicketRow {
  _id: string;
  ticketId: string;
  customerRef: string;
  customerName?: string;
  projectRef: string;
  projectName?: string;
  productName?: string;
  title: string;
  description?: string;
  status: UpdateTicketStatus;
  quotedPrice?: number;
  pricedAt?: string;
  pricedByName?: string;
  approvedAt?: string;
  approvedByName?: string;
  assignees?: { _id: string; name: string }[];
  workerPayoutValue?: number;
  assignedAt?: string;
  assignedByName?: string;
  linkedPaymentPlanId?: string;
  requestedAt: string;
  workerSubmittedAt?: string;
  completedAt?: string;
  completedByWorkerName?: string;
  adminApprovedAt?: string;
  adminApprovedByName?: string;
  createdByName?: string;
}

interface EmployeeOption {
  _id: string;
  name: string;
  role: string;
}

const STATUS_LABELS: Record<UpdateTicketStatus, string> = {
  REQUESTED: 'Awaiting price',
  PRICED: 'Price set',
  APPROVED: 'Customer approved',
  IN_PROGRESS: 'In progress',
  PENDING_REVIEW: 'Ready for review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_CLASSES: Record<UpdateTicketStatus, string> = {
  REQUESTED: 'bg-amber-100 text-amber-800',
  PRICED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  PENDING_REVIEW: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

function fmtRs(n: number): string {
  return `LKR ${Number(n || 0).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UpdateTickets() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'pm';
  const [searchParams] = useSearchParams();
  const initialCustomerId = searchParams.get('customerId') || undefined;
  const initialProjectId = searchParams.get('projectId') || undefined;
  const initialStatus = searchParams.get('status') || '';

  const [tickets, setTickets] = useState<UpdateTicketRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [pricingId, setPricingId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [pricingSubmitting, setPricingSubmitting] = useState(false);
  const [assignTicket, setAssignTicket] = useState<UpdateTicketRow | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [payoutInput, setPayoutInput] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [billingTicket, setBillingTicket] = useState<UpdateTicketRow | null>(null);
  const [billingForm, setBillingForm] = useState({ downPct: '40', months: '3', serviceFeePct: '0' });
  const [billingSubmitting, setBillingSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<UpdateTicketRow[]>(`/update-tickets${qs}`);
      if (res.success && res.data) setTickets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    void load();
    void api.get<EmployeeOption[]>('/users').then((res) => {
      if (res.success && res.data) {
        setEmployees(res.data.filter((u) => u.role === 'employee'));
      }
    });
  }, [canManage, statusFilter]);

  useEffect(() => {
    if (initialCustomerId || initialProjectId) setShowCreate(true);
  }, [initialCustomerId, initialProjectId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    void load();
  };

  const openPricing = (ticket: UpdateTicketRow) => {
    setPricingId(ticket._id);
    setPriceInput(ticket.quotedPrice != null ? String(ticket.quotedPrice) : '');
  };

  const submitPrice = async () => {
    if (!pricingId) return;
    const quotedPrice = parseFloat(priceInput);
    if (!Number.isFinite(quotedPrice) || quotedPrice < 0) {
      pushSystemToast('Enter a valid price (LKR)', 'warning');
      return;
    }
    setPricingSubmitting(true);
    try {
      const res = await api.patch<UpdateTicketRow>(`/update-tickets/${pricingId}/price`, { quotedPrice });
      if (res.success) {
        pushSystemToast('Update price saved', 'success');
        setPricingId(null);
        await load();
      } else {
        pushSystemToast(res.error?.message || 'Failed to set price', 'error');
      }
    } finally {
      setPricingSubmitting(false);
    }
  };

  const openAssign = (ticket: UpdateTicketRow) => {
    setAssignTicket(ticket);
    setSelectedWorkerId(ticket.assignees?.[0]?._id || '');
    setPayoutInput(
      ticket.workerPayoutValue != null && ticket.workerPayoutValue > 0
        ? String(ticket.workerPayoutValue)
        : ''
    );
  };

  const submitAssign = async () => {
    if (!assignTicket) return;
    if (!selectedWorkerId) {
      pushSystemToast('Select a worker for this update task', 'warning');
      return;
    }
    const workerPayoutValue = parseFloat(payoutInput);
    if (!Number.isFinite(workerPayoutValue) || workerPayoutValue < 0) {
      pushSystemToast('Enter the worker payout amount (LKR)', 'warning');
      return;
    }
    setAssignSubmitting(true);
    try {
      const res = await api.patch<UpdateTicketRow>(`/update-tickets/${assignTicket._id}/assign`, {
        workerId: selectedWorkerId,
        assignedEmployeeIds: [selectedWorkerId],
        workerPayoutValue,
      });
      if (res.success) {
        pushSystemToast('Worker assigned — payout recorded', 'success');
        setAssignTicket(null);
        await load();
      } else {
        pushSystemToast(res.error?.message || 'Failed to assign worker', 'error');
      }
    } finally {
      setAssignSubmitting(false);
    }
  };

  const openBilling = (ticket: UpdateTicketRow) => {
    setBillingTicket(ticket);
    setBillingForm({ downPct: '40', months: '3', serviceFeePct: '0' });
  };

  const submitBilling = async () => {
    if (!billingTicket) return;
    const downPaymentPct = parseFloat(billingForm.downPct);
    const totalInstallments = parseInt(billingForm.months, 10);
    const serviceFeePct = parseFloat(billingForm.serviceFeePct);
    if (!Number.isFinite(downPaymentPct) || downPaymentPct < 0 || downPaymentPct > 100) {
      pushSystemToast('Down payment % must be 0–100', 'warning');
      return;
    }
    if (!Number.isFinite(totalInstallments) || totalInstallments < 1) {
      pushSystemToast('Installments must be at least 1', 'warning');
      return;
    }
    setBillingSubmitting(true);
    try {
      const res = await api.post<UpdateTicketRow>(`/update-tickets/${billingTicket._id}/billing`, {
        downPaymentPct,
        totalInstallments,
        serviceFeePct: Number.isFinite(serviceFeePct) ? serviceFeePct : 0,
      });
      if (res.success) {
        pushSystemToast('Add-on payment plan created — customer notified', 'success');
        setBillingTicket(null);
        await load();
      } else {
        pushSystemToast(res.error?.message || 'Failed to create billing', 'error');
      }
    } finally {
      setBillingSubmitting(false);
    }
  };

  const runAction = async (ticketId: string, action: 'approve' | 'approveCompletion' | 'complete' | 'cancel') => {
    setActionLoadingId(ticketId);
    try {
      const path =
        action === 'approve'
          ? `/update-tickets/${ticketId}/approve`
          : action === 'approveCompletion'
            ? `/update-tickets/${ticketId}/approve-completion`
            : action === 'complete'
              ? `/update-tickets/${ticketId}/complete`
              : `/update-tickets/${ticketId}/cancel`;
      const res = await api.patch<UpdateTicketRow>(path, {});
      if (res.success) {
        const msg =
          action === 'approve'
            ? 'Customer approval recorded'
            : action === 'approveCompletion'
              ? 'Update approved — worker payout credited and customer notified'
              : action === 'complete'
                ? 'Update marked completed'
                : 'Ticket cancelled';
        pushSystemToast(msg, 'success');
        await load();
      } else {
        pushSystemToast(res.error?.message || 'Action failed', 'error');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!canManage) {
    return (
      <div className={styles.page}>
        <p className="text-sm text-gray-600">Update tickets are available to owners and project managers only.</p>
      </div>
    );
  }

  const awaitingCount = tickets.filter((t) => t.status === 'REQUESTED').length;
  const pricedCount = tickets.filter((t) => t.status === 'PRICED').length;
  const pendingReviewCount = tickets.filter((t) => t.status === 'PENDING_REVIEW').length;

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="text-primary" size={26} />
            Update Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Request → Price → Customer approval → Billing → Assign worker → Worker completes → Admin approves
            {awaitingCount > 0 ? (
              <span className="ml-1 font-semibold text-amber-700">{awaitingCount} awaiting price.</span>
            ) : null}
            {pricedCount > 0 ? (
              <span className="ml-1 font-semibold text-blue-700">{pricedCount} awaiting approval.</span>
            ) : null}
            {pendingReviewCount > 0 ? (
              <span className="ml-1 font-semibold text-orange-700">{pendingReviewCount} ready for your review.</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          New update ticket
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-xs text-gray-600">
        {(['REQUESTED', 'PRICED', 'APPROVED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED'] as UpdateTicketStatus[]).map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1">
            {i > 0 ? <span className="text-gray-300">→</span> : null}
            <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_CLASSES[s]}`}>{STATUS_LABELS[s]}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="REQUESTED">Awaiting price</option>
          <option value="PRICED">Price set</option>
          <option value="APPROVED">Customer approved</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="PENDING_REVIEW">Ready for review</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px] max-w-md">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket ID or title..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium hover:bg-gray-200">
            Search
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          aria-label="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Customer / Project</th>
              <th>Request</th>
              <th>Status</th>
              <th>Price</th>
              <th>Worker</th>
              <th>Worker payout</th>
              <th>Workflow</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  No update tickets yet.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t._id}>
                  <td>
                    <div className="font-mono text-sm font-semibold">{t.ticketId}</div>
                    <div className="text-xs text-gray-500">{fmtDate(t.requestedAt)}</div>
                  </td>
                  <td>
                    <Link to={`/customer/${t.customerRef}`} className="text-primary hover:underline font-medium">
                      {t.customerName || '—'}
                    </Link>
                    <div className="text-sm text-gray-700">{t.projectName || '—'}</div>
                    {t.productName ? <div className="text-xs text-gray-500">{t.productName}</div> : null}
                  </td>
                  <td>
                    <div className="font-medium max-w-xs truncate" title={t.title}>
                      {t.title}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASSES[t.status]}`}
                    >
                      {STATUS_LABELS[t.status]}
                    </span>
                    {t.approvedAt ? (
                      <div className="text-xs text-gray-500 mt-1">Customer approved {fmtDate(t.approvedAt)}</div>
                    ) : null}
                    {t.workerSubmittedAt ? (
                      <div className="text-xs text-orange-700 mt-1 font-medium">
                        Worker submitted {fmtDate(t.workerSubmittedAt)}
                        {t.completedByWorkerName ? ` · ${t.completedByWorkerName}` : ''}
                      </div>
                    ) : null}
                    {t.adminApprovedAt ? (
                      <div className="text-xs text-emerald-700 mt-1">
                        Approved {fmtDate(t.adminApprovedAt)}
                        {t.adminApprovedByName ? ` · ${t.adminApprovedByName}` : ''}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {t.quotedPrice != null ? (
                      <span className="font-semibold text-gray-900">{fmtRs(t.quotedPrice)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {t.linkedPaymentPlanId ? (
                      <div className="text-xs text-emerald-700 font-medium mt-0.5">Billed</div>
                    ) : null}
                  </td>
                  <td className="text-sm">
                    {t.assignees && t.assignees.length > 0 ? (
                      <div>
                        <span className="font-medium">{t.assignees[0].name}</span>
                        {t.assignees.length > 1 ? (
                          <span className="text-xs text-gray-500"> +{t.assignees.length - 1}</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="text-sm">
                    {t.workerPayoutValue != null && t.workerPayoutValue > 0 ? (
                      <span className="font-semibold text-gray-900">{fmtRs(t.workerPayoutValue)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1 items-start">
                      {t.status === 'REQUESTED' ||
                      (t.status !== 'CANCELLED' && t.status !== 'COMPLETED' && t.status !== 'PENDING_REVIEW') ? (
                        <button
                          type="button"
                          onClick={() => openPricing(t)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <Tag size={12} />
                          {t.quotedPrice != null ? 'Edit price' : 'Set price'}
                        </button>
                      ) : null}
                      {t.status === 'PRICED' ? (
                        <button
                          type="button"
                          disabled={actionLoadingId === t._id}
                          onClick={() => void runAction(t._id, 'approve')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
                        >
                          <CheckCircle2 size={12} />
                          Record approval
                        </button>
                      ) : null}
                      {(t.status === 'APPROVED' || t.status === 'IN_PROGRESS') && !t.linkedPaymentPlanId ? (
                        <button
                          type="button"
                          onClick={() => openBilling(t)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          <CreditCard size={12} />
                          Create billing
                        </button>
                      ) : null}
                      {t.linkedPaymentPlanId ? (
                        <Link
                          to={`/payment-plans?projectId=${t.projectRef}`}
                          className="text-xs font-semibold text-gray-600 hover:underline"
                        >
                          View payment plan
                        </Link>
                      ) : null}
                      {t.status === 'APPROVED' || t.status === 'IN_PROGRESS' ? (
                        <button
                          type="button"
                          onClick={() => openAssign(t)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:underline"
                        >
                          <Users size={12} />
                          {t.assignees?.length ? 'Change worker' : 'Assign worker'}
                        </button>
                      ) : null}
                      {t.status === 'PENDING_REVIEW' ? (
                        <button
                          type="button"
                          disabled={actionLoadingId === t._id}
                          onClick={() => void runAction(t._id, 'approveCompletion')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={12} />
                          Approve
                        </button>
                      ) : null}
                      {t.status === 'IN_PROGRESS' ? (
                        <button
                          type="button"
                          disabled={actionLoadingId === t._id}
                          onClick={() => void runAction(t._id, 'complete')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:underline"
                          title="Admin override — skip worker submission"
                        >
                          <CheckCircle2 size={12} />
                          Mark complete (override)
                        </button>
                      ) : null}
                      {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' ? (
                        <button
                          type="button"
                          disabled={actionLoadingId === t._id}
                          onClick={() => void runAction(t._id, 'cancel')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:underline"
                        >
                          <XCircle size={12} />
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateUpdateTicketModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setLoading(true);
          void load();
        }}
        initialCustomerId={initialCustomerId}
        initialProjectId={initialProjectId}
      />

      {pricingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Set update price</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the amount the customer will pay. Status becomes <strong>Price set</strong>.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quoted price (LKR)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPricingId(null)}
                disabled={pricingSubmitting}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitPrice()}
                disabled={pricingSubmitting}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold"
              >
                {pricingSubmitting ? 'Saving...' : 'Save price'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Worker assignment</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{assignTicket.ticketId}</strong> — {assignTicket.title}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Assign the worker who will deliver this update and record their payout for this task. Customer
              quoted price:{' '}
              {assignTicket.quotedPrice != null ? fmtRs(assignTicket.quotedPrice) : '—'} (separate from worker
              payout).
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">Worker / developer</label>
            {employees.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">No workers in Team Management. Add employees first.</p>
            ) : (
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4 text-sm"
              >
                <option value="">Select worker...</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Worker payout (LKR) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              min={0}
              required
              value={payoutInput}
              onChange={(e) => setPayoutInput(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-1"
              placeholder="Amount paid to worker for this task"
            />
            <p className="text-xs text-gray-500 mb-4">
              This is what the assigned worker earns for completing this update — not what the customer pays.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setAssignTicket(null)}
                disabled={assignSubmitting}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAssign()}
                disabled={assignSubmitting || employees.length === 0}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold"
              >
                {assignSubmitting ? 'Saving...' : 'Assign worker & record payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {billingTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Create billing</h3>
            <p className="text-sm text-gray-600 mb-2">
              Add-on payment plan for <strong>{fmtRs(billingTicket.quotedPrice || 0)}</strong> (separate from main
              contract).
            </p>
            <p className="text-xs text-gray-500 mb-4">Customer receives a system notification with payment terms.</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Down payment %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={billingForm.downPct}
              onChange={(e) => setBillingForm((f) => ({ ...f, downPct: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-3"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Installment months</label>
            <input
              type="number"
              min={1}
              value={billingForm.months}
              onChange={(e) => setBillingForm((f) => ({ ...f, months: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-3"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Service fee % (optional)</label>
            <input
              type="number"
              min={0}
              value={billingForm.serviceFeePct}
              onChange={(e) => setBillingForm((f) => ({ ...f, serviceFeePct: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setBillingTicket(null)}
                disabled={billingSubmitting}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitBilling()}
                disabled={billingSubmitting}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold"
              >
                {billingSubmitting ? 'Creating...' : 'Create payment plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
