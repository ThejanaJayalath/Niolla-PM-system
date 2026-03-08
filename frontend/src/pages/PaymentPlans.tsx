import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import AddPaymentPlanModal from '../components/AddPaymentPlanModal';
import styles from './Inquiries.module.css';

interface PaymentPlan {
  _id: string;
  projectId: string;
  projectName?: string;
  downPaymentPct: number;
  downPaymentAmt: number;
  totalInstallments: number;
  installmentAmt: number;
  remainingBalance: number;
  planStartDate?: string;
  status: 'active' | 'completed' | 'defaulted';
}

interface ProjectOption {
  _id: string;
  projectName: string;
  totalValue: number;
}

export default function PaymentPlans() {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState<PaymentPlan | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPlans = async () => {
    try {
      const params = new URLSearchParams();
      if (projectFilter) params.append('projectId', projectFilter);
      if (statusFilter) params.append('status', statusFilter);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<PaymentPlan[]>(`/payment-plans${queryString}`);
      if (res.success && res.data) setPlans(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await api.get<ProjectOption[]>('/projects');
      if (res.success && res.data) setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPlans();
  }, [projectFilter, statusFilter]);

  const handleAdd = () => {
    setEditPlan(null);
    setShowModal(true);
  };

  const handleEdit = (p: PaymentPlan) => {
    setEditPlan(p);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditPlan(null);
    loadPlans();
  };

  const handleDelete = async () => {
    const id = deleteId;
    if (!id) return;
    setDeleting(true);
    setDeleteId(null);
    try {
      const res = await api.delete(`/payment-plans/${id}`);
      if (res?.success !== false) await loadPlans();
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;
  const totalPages = Math.ceil(plans.length / rowsPerPage);
  const paginated = plans.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Payment Plans</h1>
        <button
          onClick={handleAdd}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Payment Plan
        </button>
      </div>

      <div className={styles.filtersRow}>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.projectName}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="defaulted">Defaulted</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Down %</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Down Amount</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Installments</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Installment Amt</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Remaining</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Start Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm !text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                  No payment plans yet. Add a plan for a project to get started.
                </td>
              </tr>
            ) : (
              <>
                {paginated.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">{p.projectName || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{p.downPaymentPct}%</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      Rs. {Number(p.downPaymentAmt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.totalInstallments}</td>
                    <td className="px-6 py-4 text-gray-600">
                      Rs. {Number(p.installmentAmt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      Rs. {Number(p.remainingBalance).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(p.planStartDate)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          p.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : p.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          className="p-2 text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(p._id)}
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
                    {Array.from({ length: 9 }).map((_, i) => (
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
              {plans.length === 0
                ? '0-0 of 0'
                : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, plans.length)} of ${plans.length}`}
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

      <AddPaymentPlanModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditPlan(null);
        }}
        onSuccess={handleCloseModal}
        editPlan={editPlan}
        projects={projects}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Payment Plan"
        message="Are you sure you want to delete this payment plan?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
