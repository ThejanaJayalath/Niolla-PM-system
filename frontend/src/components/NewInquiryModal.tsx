import { useState, useRef, useEffect } from 'react';
import { X, User, Phone, FileText } from 'lucide-react';
import { api } from '../api/client';
import styles from './NewInquiryModal.module.css';

interface FormState {
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes: string;
}

interface NewInquiryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewInquiryModal({ open, onClose, onSuccess }: NewInquiryModalProps) {
  const featureInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({
    customerName: '',
    phoneNumber: '',
    projectDescription: '',
    requiredFeatures: [],
    internalNotes: '',
  });
  const [featureInput, setFeatureInput] = useState('');
  const [duplicateAlert, setDuplicateAlert] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({
        customerName: '',
        phoneNumber: '',
        projectDescription: '',
        requiredFeatures: [],
        internalNotes: '',
      });
      setFeatureInput('');
      setDuplicateAlert(false);
      setError('');
    }
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'phoneNumber') setDuplicateAlert(false);
  };

  const addFeature = () => {
    const val = featureInput.trim();
    if (val && !form.requiredFeatures.includes(val)) {
      setForm((prev) => ({ ...prev, requiredFeatures: [...prev.requiredFeatures, val] }));
      setFeatureInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature();
    }
  };

  const removeFeature = (index: number) => {
    setForm((prev) => ({
      ...prev,
      requiredFeatures: prev.requiredFeatures.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      customerName: form.customerName,
      phoneNumber: form.phoneNumber,
      projectDescription: form.projectDescription,
      requiredFeatures: form.requiredFeatures,
      internalNotes: form.internalNotes,
    };
    const res = await api.post<unknown>('/inquiries', payload);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to save');
      return;
    }
    // @ts-ignore
    if (res.meta?.duplicatePhone) {
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
          <h2 className={styles.title}>Add New Inquiry</h2>
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
              Phone number already exists. Inquiry created successfully. Redirecting...
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="customerName">
              <User size={18} />
              Name
            </label>
            <input
              id="customerName"
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter Customer Name"
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
              placeholder="Enter Phone Number"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="projectDescription">Description</label>
            <textarea
              id="projectDescription"
              name="projectDescription"
              value={form.projectDescription}
              onChange={handleChange}
              required
              rows={4}
              className={styles.textarea}
              placeholder="Add Description"
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              <FileText size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
              Features
            </label>
            <div className={styles.addFeatureRow}>
              <input
                ref={featureInputRef}
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className={styles.input}
                placeholder="Add required features"
              />
              <button type="button" onClick={addFeature} className={styles.addBtn}>
                Add
              </button>
            </div>
            {form.requiredFeatures.length > 0 && (
              <div className={styles.tagList}>
                {form.requiredFeatures.map((f, i) => (
                  <span key={i} className={styles.tag}>
                    {f}
                    <button type="button" onClick={() => removeFeature(i)} className={styles.tagRemove} aria-label="Remove">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="internalNotes">
              <FileText size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
              Internal Notes
            </label>
            <textarea
              id="internalNotes"
              name="internalNotes"
              value={form.internalNotes}
              onChange={handleChange}
              rows={3}
              className={styles.textarea}
              placeholder="Add internal notes..."
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? 'Creating...' : 'Create Inquiry'}
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
