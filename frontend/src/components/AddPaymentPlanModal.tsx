import { useState, useEffect } from 'react';
import { X, FolderKanban, Percent, Hash, Calendar } from 'lucide-react';
import { api } from '../api/client';
import styles from './NewInquiryModal.module.css';

interface PaymentPlan {
  _id: string;
  projectId: string;
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

interface AddPaymentPlanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editPlan: PaymentPlan | null;
  projects: ProjectOption[];
}

export default function AddPaymentPlanModal({
  open,
  onClose,
  onSuccess,
  editPlan,
  projects,
}: AddPaymentPlanModalProps) {
  const [projectId, setProjectId] = useState('');
  const [downPaymentPct, setDownPaymentPct] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [planStartDate, setPlanStartDate] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'defaulted'>('active');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editPlan?._id;
  const selectedProject = projects.find((p) => p._id === projectId);
  const totalValue = selectedProject?.totalValue ?? 0;
  const pct = parseFloat(downPaymentPct) || 0;
  const installments = parseInt(totalInstallments, 10) || 0;
  const downPaymentAmt = totalValue * (pct / 100);
  const remainingBalance = totalValue - downPaymentAmt;
  const installmentAmt = installments > 0 ? remainingBalance / installments : 0;

  useEffect(() => {
    if (!open) {
      setProjectId('');
      setDownPaymentPct('');
      setTotalInstallments('');
      setPlanStartDate('');
      setError('');
    } else if (editPlan) {
      setProjectId(editPlan.projectId);
      setDownPaymentPct(String(editPlan.downPaymentPct));
      setTotalInstallments(String(editPlan.totalInstallments));
      setPlanStartDate(editPlan.planStartDate ? editPlan.planStartDate.slice(0, 10) : '');
      setStatus(editPlan.status || 'active');
    } else {
      setProjectId(projects[0]?._id ?? '');
      setDownPaymentPct('');
      setTotalInstallments('');
      setPlanStartDate('');
      setStatus('active');
    }
  }, [open, editPlan, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isEdit && !projectId) {
      setError('Please select a project');
      return;
    }
    if (!isEdit) {
      if (!downPaymentPct || pct < 0 || pct > 100) {
        setError('Down payment % must be between 0 and 100');
        return;
      }
      if (!totalInstallments || installments < 1 || installments > 24) {
        setError('Installments must be between 1 and 24');
        return;
      }
    }
    setSubmitting(true);
    if (isEdit) {
      const res = await api.patch<unknown>(`/payment-plans/${editPlan._id}`, {
        planStartDate: planStartDate || undefined,
        status,
      });
      setSubmitting(false);
      if (!res.success) {
        setError(res.error?.message || 'Failed to update');
        return;
      }
    } else {
      const res = await api.post<unknown>('/payment-plans', {
        projectId,
        downPaymentPct: pct,
        downPaymentAmt: Math.round(downPaymentAmt * 100) / 100,
        totalInstallments: installments,
        installmentAmt: Math.round(installmentAmt * 100) / 100,
        remainingBalance: Math.round(remainingBalance * 100) / 100,
        planStartDate: planStartDate || undefined,
        status: 'active',
      });
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
          <h2 className={styles.title}>{isEdit ? 'Edit Payment Plan' : 'Add Payment Plan'}</h2>
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
              <label htmlFor="projectId">
                <FolderKanban size={18} />
                Project *
              </label>
              <select
                id="projectId"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required={!isEdit}
                className={styles.input}
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.projectName} (Rs. {Number(p.totalValue).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isEdit && selectedProject && (
            <div className={styles.formGroup}>
              <label>Project total value</label>
              <div className={styles.input} style={{ background: '#f3f4f6', color: '#374151' }}>
                Rs. {Number(totalValue).toLocaleString()}
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="downPaymentPct">
              <Percent size={18} />
              Down Payment %
            </label>
            <input
              id="downPaymentPct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={downPaymentPct}
              onChange={(e) => setDownPaymentPct(e.target.value)}
              required={!isEdit}
              disabled={isEdit}
              className={styles.input}
              placeholder="e.g. 20"
            />
          </div>

          {!isEdit && (
            <>
              <div className={styles.formGroup}>
                <label>Down Payment Amount</label>
                <div className={styles.input} style={{ background: '#f3f4f6', color: '#374151' }}>
                  Rs. {downPaymentAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="totalInstallments">
                  <Hash size={18} />
                  Number of Installments (1–24)
                </label>
                <input
                  id="totalInstallments"
                  type="number"
                  min="1"
                  max="24"
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                  required={!isEdit}
                  className={styles.input}
                  placeholder="e.g. 6"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Installment Amount</label>
                <div className={styles.input} style={{ background: '#f3f4f6', color: '#374151' }}>
                  Rs. {installmentAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Remaining Balance</label>
                <div className={styles.input} style={{ background: '#f3f4f6', color: '#374151' }}>
                  Rs. {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="planStartDate">
              <Calendar size={18} />
              Plan Start Date
            </label>
            <input
              id="planStartDate"
              type="date"
              value={planStartDate}
              onChange={(e) => setPlanStartDate(e.target.value)}
              className={styles.input}
            />
          </div>

          {isEdit && (
            <div className={styles.formGroup}>
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'completed' | 'defaulted')}
                className={styles.input}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="defaulted">Defaulted</option>
              </select>
            </div>
          )}

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? (isEdit ? 'Updating…' : 'Creating…') : isEdit ? 'Update Plan' : 'Add Payment Plan'}
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
