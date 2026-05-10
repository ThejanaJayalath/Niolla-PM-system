import { useState, useEffect } from 'react';
import { X, FolderKanban, User, Type, DollarSign, Calendar, FileText } from 'lucide-react';
import { api } from '../api/client';
import type { ProjectLifecycleStatus } from '../types/projectLifecycle';
import { normalizeProjectStatus } from '../types/projectLifecycle';
import styles from './NewInquiryModal.module.css';

export interface ProjectFormData {
  clientId: string;
  projectName: string;
  description: string;
  systemType: string;
  totalValue: string;
  expenses: string;
  startDate: string;
  endDate: string;
  status: ProjectLifecycleStatus;
}

interface Project {
  _id: string;
  clientId: string;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  expenses?: number;
  startDate?: string;
  endDate?: string;
  status: ProjectLifecycleStatus;
}

interface CustomerOption {
  _id: string;
  name: string;
  customerId: string;
}

interface AddProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProject: Project | null;
  customers: CustomerOption[];
  initialCustomerId?: string | null;
}

export default function AddProjectModal({
  open,
  onClose,
  onSuccess,
  editProject,
  customers,
  initialCustomerId,
}: AddProjectModalProps) {
  const [form, setForm] = useState<ProjectFormData>({
    clientId: '',
    projectName: '',
    description: '',
    systemType: '',
    totalValue: '',
    expenses: '',
    startDate: '',
    endDate: '',
    status: 'unassigned',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editProject?._id;

  useEffect(() => {
    if (!open) {
      setForm({
        clientId: '',
        projectName: '',
        description: '',
        systemType: '',
        totalValue: '',
        expenses: '',
        startDate: '',
        endDate: '',
        status: 'unassigned',
      });
      setError('');
    } else if (editProject) {
      setForm({
        clientId: editProject.clientId,
        projectName: editProject.projectName,
        description: editProject.description || '',
        systemType: editProject.systemType || '',
        totalValue: String(editProject.totalValue ?? ''),
        expenses:
          editProject.expenses !== undefined && editProject.expenses !== null
            ? String(editProject.expenses)
            : '',
        startDate: editProject.startDate ? editProject.startDate.slice(0, 10) : '',
        endDate: editProject.endDate ? editProject.endDate.slice(0, 10) : '',
        status: normalizeProjectStatus(editProject.status),
      });
    } else {
      setForm({
        clientId: initialCustomerId || (customers[0]?._id ?? ''),
        projectName: '',
        description: '',
        systemType: '',
        totalValue: '',
        expenses: '',
        startDate: '',
        endDate: '',
        status: 'unassigned',
      });
    }
  }, [open, editProject, customers, initialCustomerId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.clientId && !isEdit) {
      setError('Please select a client');
      return;
    }
    if (!form.projectName.trim()) {
      setError('Project name is required');
      return;
    }
    const totalValue = parseFloat(form.totalValue);
    if (isNaN(totalValue) || totalValue < 0) {
      setError('Total value must be a valid number');
      return;
    }
    let expensesNum = 0;
    if (form.expenses.trim() !== '') {
      expensesNum = parseFloat(form.expenses);
      if (isNaN(expensesNum) || expensesNum < 0) {
        setError('Expenses must be a valid non-negative number');
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      clientId: form.clientId,
      projectName: form.projectName.trim(),
      description: form.description.trim() || undefined,
      systemType: form.systemType.trim() || undefined,
      totalValue,
      expenses: expensesNum,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      status: form.status,
    };
    if (isEdit) {
      const res = await api.patch<unknown>(`/projects/${editProject._id}`, {
        projectName: payload.projectName,
        description: payload.description,
        systemType: payload.systemType,
        totalValue: payload.totalValue,
        expenses: payload.expenses,
        startDate: payload.startDate,
        endDate: payload.endDate,
        status: payload.status,
      });
      setSubmitting(false);
      if (!res.success) {
        setError(res.error?.message || 'Failed to update');
        return;
      }
    } else {
      const res = await api.post<unknown>('/projects', payload);
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
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '28rem' }}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Edit Project' : 'Add Project'}</h2>
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

          {!isEdit && (
            <div className={styles.formGroup}>
              <label htmlFor="clientId">
                <User size={18} />
                Client *
              </label>
              <select
                id="clientId"
                name="clientId"
                value={form.clientId}
                onChange={handleChange}
                required={!isEdit}
                className={styles.input}
              >
                <option value="">Select client…</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.customerId ? `(${c.customerId})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="projectName">
              <FolderKanban size={18} />
              Project Name *
            </label>
            <input
              id="projectName"
              name="projectName"
              value={form.projectName}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="e.g. Client Portal v2"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="systemType">
              <Type size={18} />
              System Type
            </label>
            <input
              id="systemType"
              name="systemType"
              value={form.systemType}
              onChange={handleChange}
              className={styles.input}
              placeholder="e.g. Web App, Mobile App"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="totalValue">
              <DollarSign size={18} />
              Total Value (Rs.) *
            </label>
            <input
              id="totalValue"
              name="totalValue"
              type="number"
              min="0"
              step="0.01"
              value={form.totalValue}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="0"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="expenses">
              <DollarSign size={18} />
              Other expenses (Rs.)
            </label>
            <input
              id="expenses"
              name="expenses"
              type="number"
              min="0"
              step="0.01"
              value={form.expenses}
              onChange={handleChange}
              className={styles.input}
              placeholder="0 — optional"
            />
            <p className="text-xs text-gray-500 mt-1">
              Non-developer costs. Net profit = total value − (developer payouts + expenses).
            </p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="startDate">
              <Calendar size={18} />
              Start Date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              value={form.startDate}
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="endDate">End Date</label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              value={form.endDate}
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">
              <FileText size={18} />
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="Project description (optional)"
              rows={3}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className={styles.input}
            >
              <option value="unassigned">Unassigned</option>
              <option value="under_development">Under development</option>
              <option value="completed">Completed</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? (isEdit ? 'Updating…' : 'Creating…') : isEdit ? 'Update Project' : 'Add Project'}
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
