import { useState, useEffect } from 'react';
import { X, User, Phone, Layers, FileText } from 'lucide-react';
import { api } from '../api/client';
import { INQUIRY_BUSINESS_MODEL_VALUES } from '../constants/inquiryBusinessModels';
import styles from './NewInquiryModal.module.css';

interface FormState {
  customerName: string;
  phoneNumber: string;
  businessModel: string;
  projectDescription: string;
  dateOfBirth: string;
}

interface NewProspectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewProspectModal({ open, onClose, onSuccess }: NewProspectModalProps) {
  const [form, setForm] = useState<FormState>({
    customerName: '',
    phoneNumber: '',
    businessModel: '',
    projectDescription: '',
  });
  const [duplicateAlert, setDuplicateAlert] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({
        customerName: '',
        phoneNumber: '',
        businessModel: '',
        projectDescription: '',
      });
      setDuplicateAlert(false);
      setError('');
    }
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'phoneNumber') setDuplicateAlert(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.businessModel) {
      setError('Please select a business model.');
      return;
    }
    setSubmitting(true);
    const payload = {
      customerName: form.customerName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      businessModel: form.businessModel,
      projectDescription: form.projectDescription.trim(),
      requiredFeatures: [] as string[],
      dateOfBirth: form.dateOfBirth.trim() || undefined,
    };
    const res = await api.post<unknown>('/inquiries', payload);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to save');
      return;
    }
    if (res.meta && res.meta.duplicatePhone === true) {
      setDuplicateAlert(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
      return;
    }
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    setError('');
    setDuplicateAlert(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Add prospect</h2>
          <button type="button" onClick={handleClose} className={styles.closeBtn} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
            </div>
          )}
          {duplicateAlert && (
            <div className={styles.duplicateAlert}>
              Phone number already exists. Prospect created successfully. Redirecting...
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="prospect-customerName">
              <User size={18} />
              Name (required)
            </label>
            <input
              id="prospect-customerName"
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Contact or business name"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="prospect-phoneNumber">
              <Phone size={18} />
              Phone number (required)
            </label>
            <input
              id="prospect-phoneNumber"
              name="phoneNumber"
              type="tel"
              value={form.phoneNumber}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter phone number"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="prospect-dateOfBirth">Date of birth (optional)</label>
            <input
              id="prospect-dateOfBirth"
              name="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="prospect-businessModel">
              <Layers size={18} />
              Business model (required)
            </label>
            <select
              id="prospect-businessModel"
              name="businessModel"
              value={form.businessModel}
              onChange={handleChange}
              required
              className={styles.input}
            >
              <option value="">Select type (ERP, POS, …)</option>
              {INQUIRY_BUSINESS_MODEL_VALUES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="prospect-projectDescription">
              <FileText size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
              Description (optional)
            </label>
            <textarea
              id="prospect-projectDescription"
              name="projectDescription"
              value={form.projectDescription}
              onChange={handleChange}
              rows={4}
              className={styles.textarea}
              placeholder="Project details, timeline, or notes"
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? 'Creating…' : 'Create prospect'}
            </button>
            <button type="button" onClick={handleClose} disabled={submitting} className={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
