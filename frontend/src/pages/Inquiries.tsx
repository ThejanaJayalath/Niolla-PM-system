import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import NewInquiryModal from '../components/NewInquiryModal';
import styles from './Inquiries.module.css';

interface Inquiry {
  _id: string;
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  status: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  proposal_sent: 'Proposal Sent',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
};

export default function Inquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = () => {
    const q = filter ? `?status=${filter}` : '';
    api.get<Inquiry[]>(`/inquiries${q}`).then((res) => {
      if (res.success && res.data) setInquiries(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [filter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const res = await api.delete(`/inquiries/${deleteId}`);
    setDeleting(false);
    setDeleteId(null);
    if (res?.success !== false) load();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    // Optimistic update
    setInquiries((prev) =>
      prev.map((inq) => (inq._id === id ? { ...inq, status: newStatus } : inq))
    );

    const res = await api.patch<Inquiry>(`/inquiries/${id}`, { status: newStatus });

    // Revert if failed
    if (!res.success) {
      load(); // Reload to get true state
    }
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Inquiries</h1>
        <div className={styles.actions}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.select}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className={styles.primaryButton}
          >
            <Plus size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            New Inquiry
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading...</p>
      ) : inquiries.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>No inquiries yet</h3>
          <p>Click 'New Inquiry' to add your first potential customer.</p>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className={styles.emptyButton}
          >
            <Plus size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            New Inquiry
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Short Description</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inq) => (
                <tr key={inq._id}>
                  <td className={styles.cellName}>{inq.customerName}</td>
                  <td>{inq.phoneNumber}</td>
                  <td className={styles.cellDesc}>
                    {inq.projectDescription.slice(0, 60)}
                    {inq.projectDescription.length > 60 ? '…' : ''}
                  </td>
                  <td>
                    <select
                      value={inq.status}
                      onChange={(e) => updateStatus(inq._id, e.target.value)}
                      className={`${styles.statusSelect} badge-${inq.status}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {Object.keys(STATUS_LABELS).map((statusKey) => (
                        <option key={statusKey} value={statusKey}>
                          {STATUS_LABELS[statusKey]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{format(new Date(inq.createdAt), 'MMM d, yyyy')}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        to={`/inquiries/${inq._id}`}
                        className={styles.iconBtn}
                        title="View"
                        aria-label="View"
                      >
                        <Eye size={18} />
                      </Link>
                      <Link
                        to={`/inquiries/${inq._id}/edit`}
                        className={styles.iconBtn}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil size={18} />
                      </Link>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => setDeleteId(inq._id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewInquiryModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSuccess={load}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete inquiry"
        message="Are you sure you want to delete this inquiry? This action cannot be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
