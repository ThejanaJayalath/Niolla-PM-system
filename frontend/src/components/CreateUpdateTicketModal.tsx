import { useEffect, useState } from 'react';
import { X, User, FolderKanban, FileText } from 'lucide-react';
import { api } from '../api/client';
import styles from './NewInquiryModal.module.css';

export interface UpdateTicketFormValues {
  customerRef: string;
  projectRef: string;
  title: string;
  description: string;
  internalNotes: string;
}

interface CustomerOption {
  _id: string;
  name: string;
  customerId: string;
}

interface ProjectOption {
  _id: string;
  projectName: string;
  systemType?: string;
}

interface CreateUpdateTicketModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill when opened from a project page */
  initialCustomerId?: string;
  initialProjectId?: string;
}

export default function CreateUpdateTicketModal({
  open,
  onClose,
  onSuccess,
  initialCustomerId,
  initialProjectId,
}: CreateUpdateTicketModalProps) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState<UpdateTicketFormValues>({
    customerRef: '',
    projectRef: '',
    title: '',
    description: '',
    internalNotes: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get<CustomerOption[]>('/customers').then((res) => {
      if (res.success && res.data) setCustomers(res.data);
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      setForm({
        customerRef: '',
        projectRef: '',
        title: '',
        description: '',
        internalNotes: '',
      });
      setError('');
      setProjects([]);
      return;
    }
    setForm({
      customerRef: initialCustomerId || '',
      projectRef: initialProjectId || '',
      title: '',
      description: '',
      internalNotes: '',
    });
  }, [open, initialCustomerId, initialProjectId]);

  useEffect(() => {
    if (!open || !form.customerRef) {
      setProjects([]);
      return;
    }
    setLoadingProjects(true);
    api.get<ProjectOption[]>(`/projects?clientId=${form.customerRef}`).then((res) => {
      setProjects(res.success && res.data ? res.data : []);
      setLoadingProjects(false);
    });
  }, [open, form.customerRef]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'customerRef' ? { projectRef: '' } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.customerRef || !form.projectRef) {
      setError('Select a customer and their project (e.g. ERP system).');
      return;
    }
    if (!form.title.trim()) {
      setError('Describe the update request.');
      return;
    }
    setSubmitting(true);
    const res = await api.post('/update-tickets', {
      customerRef: form.customerRef,
      projectRef: form.projectRef,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      internalNotes: form.internalNotes.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to create update ticket');
      return;
    }
    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>New Update Ticket</h2>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <p className="text-sm text-gray-600 px-6 -mt-2 mb-2">
          Log a customer update request (e.g. new ERP feature). You can set the price after creating the ticket.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="customerRef">
              <User size={18} />
              Customer
            </label>
            <select
              id="customerRef"
              name="customerRef"
              value={form.customerRef}
              onChange={handleChange}
              required
              className={styles.input}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.customerId})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="projectRef">
              <FolderKanban size={18} />
              Project / system
            </label>
            <select
              id="projectRef"
              name="projectRef"
              value={form.projectRef}
              onChange={handleChange}
              required
              disabled={!form.customerRef || loadingProjects}
              className={styles.input}
            >
              <option value="">
                {!form.customerRef
                  ? 'Select customer first'
                  : loadingProjects
                    ? 'Loading projects...'
                    : projects.length === 0
                      ? 'No projects for this customer'
                      : 'Select project (ERP, POS, etc.)'}
              </option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.projectName}
                  {p.systemType ? ` — ${p.systemType}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="title">
              <FileText size={18} />
              Update request
            </label>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="e.g. Add inventory barcode scanning module"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Details (optional)</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              className={styles.input}
              rows={3}
              placeholder="Scope, acceptance criteria, deadline notes..."
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="internalNotes">Internal notes (optional)</label>
            <textarea
              id="internalNotes"
              name="internalNotes"
              value={form.internalNotes}
              onChange={handleChange}
              className={styles.input}
              rows={2}
              placeholder="Admin-only notes"
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? 'Creating...' : 'Create ticket'}
            </button>
            <button type="button" onClick={onClose} disabled={submitting} className={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
