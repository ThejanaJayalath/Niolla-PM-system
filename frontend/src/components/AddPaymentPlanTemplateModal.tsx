import { useState, useEffect } from 'react';
import { X, Percent, Hash } from 'lucide-react';
import { api } from '../api/client';
import styles from './NewInquiryModal.module.css';

interface PaymentPlanTemplate {
    _id: string;
    name: string;
    description?: string;
    downPaymentPct: number;
    installmentsCount: number;
    serviceFeePct: number;
    status: 'active' | 'inactive';
}

interface AddPaymentPlanTemplateModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editTemplate: PaymentPlanTemplate | null;
}

export default function AddPaymentPlanTemplateModal({
    open,
    onClose,
    onSuccess,
    editTemplate,
}: AddPaymentPlanTemplateModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [downPaymentPct, setDownPaymentPct] = useState('');
    const [installmentsCount, setInstallmentsCount] = useState('');
    const [serviceFeePct, setServiceFeePct] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isEdit = !!editTemplate?._id;

    useEffect(() => {
        if (!open) {
            setName('');
            setDescription('');
            setDownPaymentPct('');
            setInstallmentsCount('');
            setServiceFeePct('');
            setStatus('active');
            setError('');
        } else if (editTemplate) {
            setName(editTemplate.name);
            setDescription(editTemplate.description || '');
            setDownPaymentPct(String(editTemplate.downPaymentPct));
            setInstallmentsCount(String(editTemplate.installmentsCount));
            setServiceFeePct(String(editTemplate.serviceFeePct));
            setStatus(editTemplate.status);
        }
    }, [open, editTemplate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const payload = {
            name,
            description,
            downPaymentPct: Number(downPaymentPct),
            installmentsCount: Number(installmentsCount),
            serviceFeePct: Number(serviceFeePct),
            status
        };

        if (isEdit) {
            const res = await api.patch<unknown>(`/payment-plan-templates/${editTemplate._id}`, payload);
            setSubmitting(false);
            if (!res.success) {
                setError(res.error?.message || 'Failed to update');
                return;
            }
        } else {
            const res = await api.post<unknown>('/payment-plan-templates', payload);
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
                    <h2 className={styles.title}>{isEdit ? 'Edit Plan Template' : 'Add Plan Template'}</h2>
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
                        <label htmlFor="name">Template Name *</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="e.g. Standard 3-Part Plan"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="description">Description</label>
                        <input
                            id="description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={styles.input}
                        />
                    </div>

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
                            required
                            className={styles.input}
                            placeholder="e.g. 20"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="installmentsCount">
                            <Hash size={18} />
                            Number of Installments (1–24)
                        </label>
                        <input
                            id="installmentsCount"
                            type="number"
                            min="1"
                            max="24"
                            value={installmentsCount}
                            onChange={(e) => setInstallmentsCount(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="e.g. 4"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="serviceFeePct">
                            <Percent size={18} />
                            Service Fee %
                        </label>
                        <input
                            id="serviceFeePct"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={serviceFeePct}
                            onChange={(e) => setServiceFeePct(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="e.g. 5"
                        />
                    </div>

                    {isEdit && (
                        <div className={styles.formGroup}>
                            <label htmlFor="status">Status</label>
                            <select
                                id="status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                                className={styles.input}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    )}

                    <div className={styles.actions}>
                        <button type="submit" disabled={submitting} className={styles.submitBtn}>
                            {submitting ? (isEdit ? 'Updating…' : 'Creating…') : isEdit ? 'Update Template' : 'Add Template'}
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
