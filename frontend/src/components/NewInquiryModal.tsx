import { useState, useRef, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
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
      // Wait 3 seconds then close
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
      return;
    }
    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-primary px-6 py-4 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">Add Inquiries</h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {duplicateAlert && <div className="text-amber-600 text-sm bg-amber-50 p-2 rounded">Phone number already exists. Inquiry created successfully. Redirecting...</div>}

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="customerName">Name</label>
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

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="phoneNumber">Phone Number</label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter Serial Number"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="projectDescription">Description</label>
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

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} className="text-primary" /> Features
            </label>
            <div className="flex gap-2">
              <input
                ref={featureInputRef}
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`${styles.input} flex-1`}
                placeholder="Add required features"
              />
              <button
                type="button"
                onClick={addFeature}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                Add
              </button>
            </div>
            {form.requiredFeatures.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.requiredFeatures.map((f, i) => (
                  <span key={i} className="bg-orange-50 text-orange-700 px-2 py-1 rounded-lg text-xs flex items-center gap-1 border border-orange-100">
                    {f}
                    <button type="button" onClick={() => removeFeature(i)} className="hover:text-orange-900"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} htmlFor="internalNotes">
              <FileText size={16} className="text-primary" /> Internal Notes
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

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 transition-all active:scale-[0.98]"
            >
              {submitting ? 'Creating...' : 'Create Inquiries'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
