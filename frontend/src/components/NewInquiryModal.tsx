import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
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

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'phoneNumber') setDuplicateAlert(false);
  };

  const addFeature = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = featureInput.trim();
      if (val && !form.requiredFeatures.includes(val)) {
        setForm((prev) => ({ ...prev, requiredFeatures: [...prev.requiredFeatures, val] }));
        setFeatureInput('');
      }
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
    if ((res as { meta?: { duplicatePhone?: boolean } }).meta?.duplicatePhone) {
      setDuplicateAlert(true);
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
          <h2 className={styles.title}>New Inquiry</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {duplicateAlert && (
          <div className={styles.alert} role="alert">
            This phone number already exists. Please verify before proceeding.
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <label>
            Customer Name <span className={styles.required}>*</span>
            <input
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </label>
          <label>
            Phone Number <span className={styles.required}>*</span>
            <input
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="e.g. +1 234 567 8900"
            />
          </label>
          <label>
            Project Description <span className={styles.required}>*</span>
            <textarea
              name="projectDescription"
              value={form.projectDescription}
              onChange={handleChange}
              required
              rows={4}
              className={styles.input}
            />
          </label>
          <label>
            Required Features (add with Enter or comma)
            <div className={styles.tagWrap}>
              {form.requiredFeatures.map((f, i) => (
                <span key={i} className={styles.tag}>
                  {f}
                  <button type="button" className={styles.tagRemove} onClick={() => removeFeature(i)} aria-label="Remove">
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                ref={featureInputRef}
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={addFeature}
                placeholder="Type and press Enter"
                className={styles.tagInput}
              />
            </div>
          </label>
          <label>
            Internal Notes <span className={styles.optional}>(optional)</span>
            <textarea
              name="internalNotes"
              value={form.internalNotes}
              onChange={handleChange}
              rows={2}
              className={styles.input}
            />
          </label>
          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancel}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={styles.button}>
              {submitting ? 'Saving…' : 'Save Inquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
