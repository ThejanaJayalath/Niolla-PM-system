import { useState, useEffect } from 'react';
import { X, User, Phone, Mail, FolderOpen } from 'lucide-react';
import { api } from '../api/client';
import styles from './NewInquiryModal.module.css';

export interface CustomerFormData {
  name: string;
  phoneNumber: string;
  email: string;
  projects: string[];
}

interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editCustomer?: { _id: string; customerId: string; name: string; phoneNumber: string; email?: string; projects: string[] } | null;
}

export default function AddCustomerModal({ open, onClose, onSuccess, editCustomer }: AddCustomerModalProps) {
  const [form, setForm] = useState<CustomerFormData>({
    name: '',
    phoneNumber: '',
    email: '',
    projects: [],
  });
  const [projectsInput, setProjectsInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editCustomer?._id;

  useEffect(() => {
    if (!open) {
      setForm({ name: '', phoneNumber: '', email: '', projects: [] });
      setProjectsInput('');
      setError('');
    } else if (editCustomer) {
      setForm({
        name: editCustomer.name,
        phoneNumber: editCustomer.phoneNumber,
        email: editCustomer.email || '',
        projects: editCustomer.projects || [],
      });
      setProjectsInput((editCustomer.projects || []).join(', '));
    } else {
      setForm({ name: '', phoneNumber: '', email: '', projects: [] });
      setProjectsInput('');
    }
  }, [open, editCustomer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const list = projectsInput.split(',').map((s) => s.trim()).filter(Boolean);
    setForm((prev) => ({ ...prev, projects: list }));
  }, [projectsInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      phoneNumber: form.phoneNumber.trim(),
      email: form.email.trim() || undefined,
      projects: form.projects,
    };
    if (isEdit) {
      const res = await api.patch<unknown>(`/customers/${editCustomer._id}`, payload);
      setSubmitting(false);
      if (!res.success) {
        setError(res.error?.message || 'Failed to update');
        return;
      }
    } else {
      const res = await api.post<unknown>('/customers', payload);
      setSubmitting(false);
      if (!res.success) {
        setError(res.error?.message || 'Failed to create');
        return;
      }
    }
    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="name">
              <User size={18} />
              Name
            </label>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter name"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="phoneNumber">
              <Phone size={18} />
              Phone Number
            </label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter phone number"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">
              <Mail size={18} />
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className={styles.input}
              placeholder="Enter email (optional)"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="projects">
              <FolderOpen size={18} />
              Projects
            </label>
            <input
              id="projects"
              value={projectsInput}
              onChange={(e) => setProjectsInput(e.target.value)}
              className={styles.input}
              placeholder="Comma-separated project names"
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Customer' : 'Add Customer'}
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
