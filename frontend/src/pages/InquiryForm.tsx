import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '../api/client';
import styles from './InquiryForm.module.css';

interface FormState {
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes: string;
}

export default function InquiryForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
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
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<FormState & { requiredFeatures?: string[] }>(`/inquiries/${id}`).then((res) => {
      if (res.success && res.data) {
        setForm({
          customerName: res.data.customerName,
          phoneNumber: res.data.phoneNumber,
          projectDescription: res.data.projectDescription,
          requiredFeatures: res.data.requiredFeatures || [],
          internalNotes: res.data.internalNotes || '',
        });
      }
      setLoading(false);
    });
  }, [id]);

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
    const path = isEdit ? `/inquiries/${id}` : '/inquiries';
    const res = isEdit
      ? await api.patch<unknown>(path, payload)
      : await api.post<{ duplicatePhone?: boolean }>(path, payload);

    setSubmitting(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to save');
      return;
    }
    if (!isEdit && (res as { meta?: { duplicatePhone?: boolean } }).meta?.duplicatePhone)
      setDuplicateAlert(true);
    else
      navigate(isEdit ? `/inquiries/${id}` : '/inquiries');
  };

  if (loading) return <p className={styles.muted}>Loading...</p>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to={isEdit ? `/inquiries/${id}` : '/inquiries'} className={styles.back}>← Back</Link>
        <h1 className={styles.title}>{isEdit ? 'Edit Inquiry' : 'New Inquiry'}</h1>
      </div>

      <div className={styles.card}>
        {duplicateAlert && (
          <div className={styles.alert} role="alert">
            <span>⚠️</span> This phone number already exists. Please verify before proceeding.
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
              placeholder="Enter customer name"
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
              placeholder="Describe the project..."
            />
          </label>
          <label>
            Required Features
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
                placeholder={form.requiredFeatures.length === 0 ? "Type feature and press Enter" : "Add another..."}
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
              placeholder="Private notes for your team..."
            />
          </label>
          <div className={styles.actions}>
            <Link to={isEdit ? `/inquiries/${id}` : '/inquiries'} className={styles.cancel}>Cancel</Link>
            <button type="submit" disabled={submitting} className={styles.button}>
              {submitting ? 'Saving…' : 'Save Inquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
