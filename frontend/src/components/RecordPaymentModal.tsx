import { useState, useEffect } from 'react';
import { X, DollarSign, Hash, Calendar, CreditCard } from 'lucide-react';
import { api } from '../api/client';
import styles from './NewInquiryModal.module.css';

export interface InstallmentOption {
  _id: string;
  planId: string;
  projectName?: string;
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  installments: InstallmentOption[];
}

const PAYMENT_METHODS: { value: 'cash' | 'bank' | 'card' | 'online'; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
];

export default function RecordPaymentModal({
  open,
  onClose,
  onSuccess,
  installments,
}: RecordPaymentModalProps) {
  const [installmentId, setInstallmentId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'card' | 'online'>('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const payables = installments.filter((i) => i.status === 'pending' || i.status === 'partial');
  const selected = payables.find((i) => i._id === installmentId);
  const remaining = selected ? Number(selected.dueAmount) - Number(selected.paidAmount || 0) : 0;

  useEffect(() => {
    if (open) {
      setInstallmentId('');
      setAmount('');
      setPaymentMethod('cash');
      setReferenceNo('');
      const today = new Date().toISOString().slice(0, 10);
      setPaymentDate(today);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (selected && amount) {
      const num = parseFloat(amount);
      if (num > remaining) setAmount(String(remaining));
    }
  }, [selected, remaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!installmentId) {
      setError('Please select an installment');
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || amt <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    if (amt > remaining) {
      setError(`Amount cannot exceed remaining due (Rs. ${remaining.toLocaleString()})`);
      return;
    }
    if (!paymentDate) {
      setError('Payment date is required');
      return;
    }
    setSubmitting(true);
    const res = await api.post<unknown>('/payments', {
      installmentId,
      amount: amt,
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      paymentDate,
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error?.message || 'Failed to record payment');
      return;
    }
    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '28rem' }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Record Payment</h2>
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
            <label htmlFor="installmentId">
              <DollarSign size={18} />
              Installment *
            </label>
            <select
              id="installmentId"
              value={installmentId}
              onChange={(e) => {
                setInstallmentId(e.target.value);
                setAmount('');
              }}
              required
              className={styles.input}
            >
              <option value="">Select installment…</option>
              {payables.map((i) => {
                const rem = Number(i.dueAmount) - Number(i.paidAmount || 0);
                return (
                  <option key={i._id} value={i._id}>
                    {i.projectName || 'Project'} – #{i.installmentNo} – Due Rs.{rem.toLocaleString()}
                  </option>
                );
              })}
            </select>
          </div>

          {selected && (
            <div className={styles.formGroup}>
              <label>Remaining due</label>
              <div className={styles.input} style={{ background: '#f3f4f6', color: '#374151' }}>
                Rs. {remaining.toLocaleString()}
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="amount">
              <DollarSign size={18} />
              Amount (Rs.) *
            </label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className={styles.input}
              placeholder="e.g. 50000"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="paymentMethod">
              <CreditCard size={18} />
              Payment Method *
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'bank' | 'card' | 'online')}
              className={styles.input}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="referenceNo">
              <Hash size={18} />
              Reference No.
            </label>
            <input
              id="referenceNo"
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className={styles.input}
              placeholder="Cheque / transaction ref"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="paymentDate">
              <Calendar size={18} />
              Payment Date *
            </label>
            <input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={submitting} className={styles.submitBtn}>
              {submitting ? 'Recording…' : 'Record Payment'}
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
