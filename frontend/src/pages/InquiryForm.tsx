import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import styles from './InquiryForm.module.css';

interface FormState {
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string;
  internalNotes: string;
}

export default function InquiryForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    customerName: '',
    phoneNumber: '',
    projectDescription: '',
    requiredFeatures: '',
    internalNotes: '',
  });
  const [duplicateAlert, setDuplicateAlert] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<FormState & { requiredFeatures: string[] }>(`/inquiries/${id}`).then((res) => {
      if (res.success && res.data) {
        setForm({
          customerName: res.data.customerName,
          phoneNumber: res.data.phoneNumber,
          projectDescription: res.data.projectDescription,
          requiredFeatures: (res.data.requiredFeatures || []).join('\n'),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const payload = {
      ...form,
      requiredFeatures: form.requiredFeatures.split('\n').map((s) => s.trim()).filter(Boolean),
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
    if (!isEdit && (res as { meta?: { duplicatePhone?: boolean } }).meta?.duplicatePhone) setDuplicateAlert(true);
    navigate(isEdit ? `/inquiries/${id}` : '/inquiries');
  };

  if (loading) return <p className={styles.muted}>Loading...</p>;

  return (
    <div>
      <div className={styles.header}>
        <Link to={isEdit ? `/inquiries/${id}` : '/inquiries'} className={styles.back}>← Back</Link>
        <h1 className={styles.title}>{isEdit ? 'Edit inquiry' : 'New inquiry'}</h1>
      </div>

      {duplicateAlert && (
        <div className={styles.alert}>
          This phone number is already associated with another inquiry. Please check for duplicates.
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}
        <label>
          Customer name *
          <input
            name="customerName"
            value={form.customerName}
            onChange={handleChange}
            required
            className={styles.input}
          />
        </label>
        <label>
          Phone number *
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
          Project description *
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
          Required features (one per line)
          <textarea
            name="requiredFeatures"
            value={form.requiredFeatures}
            onChange={handleChange}
            rows={4}
            className={styles.input}
            placeholder="Feature 1&#10;Feature 2"
          />
        </label>
        <label>
          Internal notes
          <textarea
            name="internalNotes"
            value={form.internalNotes}
            onChange={handleChange}
            rows={2}
            className={styles.input}
          />
        </label>
        <div className={styles.actions}>
          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create inquiry'}
          </button>
          <Link to={isEdit ? `/inquiries/${id}` : '/inquiries'} className={styles.cancel}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
