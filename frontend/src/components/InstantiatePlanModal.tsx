import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { api } from '../api/client';
import styles from './NewInquiryModal.module.css';

interface PaymentPlanTemplate {
    _id: string;
    name: string;
    downPaymentPct: number;
    installmentsCount: number;
}

interface InstantiatePlanModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    template: PaymentPlanTemplate | null;
    projectId: string;
}

export default function InstantiatePlanModal({
    open,
    onClose,
    onSuccess,
    template,
    projectId
}: InstantiatePlanModalProps) {
    const [startDate, setStartDate] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!template) return;
        if (!startDate) {
            setError('Please select a plan start date');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const res = await api.post('/payment-plans/instantiate', {
                projectId,
                templateId: template._id,
                planStartDate: startDate
            });

            if (!res.success) {
                setError(res.error?.message || 'Failed to instantiate plan');
                setSubmitting(false);
                return;
            }

            onSuccess();
        } catch (err: any) {
            setError(err?.message || 'Failed to instantiate plan');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open || !template) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '28rem' }}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Attach {template.name}</h2>
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

                    <div className="mb-4 text-sm text-gray-600 bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <div className="font-semibold text-orange-800 mb-1">Plan Configuration Summary</div>
                        <ul className="list-disc pl-5">
                            <li>{template.downPaymentPct}% Down Payment</li>
                            <li>{template.installmentsCount} equal installments for the rest balance.</li>
                        </ul>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="startDate">
                            <Calendar size={18} />
                            Plan Start Date *
                        </label>
                        <input
                            id="startDate"
                            name="startDate"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.actions} style={{ marginTop: '1.5rem' }}>
                        <button type="submit" disabled={submitting} className={styles.submitBtn}>
                            {submitting ? 'Attaching…' : 'Confirm & Attach Plan'}
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
