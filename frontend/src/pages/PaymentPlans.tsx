import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import AddPaymentPlanTemplateModal from '../components/AddPaymentPlanTemplateModal';
import InstantiatePlanModal from '../components/InstantiatePlanModal';
import styles from './Inquiries.module.css';

interface PaymentPlanTemplate {
  _id: string;
  name: string;
  description?: string;
  downPaymentPct: number;
  installmentsCount: number;
  installmentPct: number;
  status: 'active' | 'inactive';
}

export default function PaymentPlans() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const instantiateFor = searchParams.get('instantiateFor');

  const [templates, setTemplates] = useState<PaymentPlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<PaymentPlanTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showInstantiateModal, setShowInstantiateModal] = useState(false);
  const [templateToInstantiate, setTemplateToInstantiate] = useState<PaymentPlanTemplate | null>(null);

  const loadTemplates = async () => {
    try {
      const res = await api.get<PaymentPlanTemplate[]>(`/payment-plan-templates`);
      if (res.success && res.data) {
        let data = res.data;
        if (statusFilter) {
          data = data.filter(t => t.status === statusFilter);
        }
        setTemplates(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadTemplates();
  }, [statusFilter]);

  const handleAdd = () => {
    setEditTemplate(null);
    setShowModal(true);
  };

  const handleEdit = (t: PaymentPlanTemplate) => {
    setEditTemplate(t);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditTemplate(null);
    loadTemplates();
  };

  const handleDelete = async () => {
    const id = deleteId;
    if (!id) return;
    setDeleting(true);
    setDeleteId(null);
    try {
      const res = await api.delete(`/payment-plan-templates/${id}`);
      if (res?.success !== false) await loadTemplates();
    } finally {
      setDeleting(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;
  const totalPages = Math.ceil(templates.length / rowsPerPage);
  const paginated = templates.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">
          {instantiateFor ? 'Select Payment Plan Template' : 'Payment Plan Templates'}
        </h1>
        {!instantiateFor && (
          <button
            onClick={handleAdd}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Add Template
          </button>
        )}
      </div>

      <div className={styles.filtersRow}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm w-[20%]">Template Name</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm w-[25%]">Description</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm w-[15%]">Down Payment %</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm w-[10%]">Installments</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm w-[10%]">Installment %</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm w-[10%]">Status</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm w-[10%] !text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No payment plan templates yet. Add a template to get started.
                </td>
              </tr>
            ) : (
              <>
                {paginated.map((t) => (
                  <tr key={t._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">{t.name}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-xs">{t.description || '—'}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{t.downPaymentPct}%</td>
                    <td className="px-6 py-4 text-gray-600">{t.installmentsCount}</td>
                    <td className="px-6 py-4 text-gray-600">{t.installmentPct}%</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${t.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {instantiateFor ? (
                        <div className="flex justify-center items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateToInstantiate(t);
                              setShowInstantiateModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 rounded-lg text-sm font-semibold transition-colors"
                          >
                            <CheckCircle2 size={16} /> Use
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(t)}
                            className="p-2 text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(t._id)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
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
              {templates.length === 0
                ? '0-0 of 0'
                : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, templates.length)} of ${templates.length}`}
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

      <AddPaymentPlanTemplateModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditTemplate(null);
        }}
        onSuccess={handleCloseModal}
        editTemplate={editTemplate}
      />

      <InstantiatePlanModal
        open={showInstantiateModal}
        onClose={() => {
          setShowInstantiateModal(false);
          setTemplateToInstantiate(null);
        }}
        onSuccess={() => {
          setShowInstantiateModal(false);
          setTemplateToInstantiate(null);
          // Return to project page
          if (instantiateFor) navigate(`/projects/${instantiateFor}`);
        }}
        template={templateToInstantiate}
        projectId={instantiateFor || ''}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Template"
        message="Are you sure you want to delete this payment plan template?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
