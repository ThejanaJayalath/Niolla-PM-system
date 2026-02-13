import { useState, useEffect } from 'react';
import { X, Plus, Calendar, User, FileText, Link2, StickyNote } from 'lucide-react';
import { api } from '../api/client';
import styles from './CreateMeetingModal.module.css';

interface CreateMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialInquiryId?: string;
}

interface Inquiry {
    _id: string;
    customerName: string;
    customerId?: string;
}

export default function CreateMeetingModal({ isOpen, onClose, onSuccess, initialInquiryId }: CreateMeetingModalProps) {
    const [loading, setLoading] = useState(false);
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [searchInquiry, setSearchInquiry] = useState('');

    const [formData, setFormData] = useState({
        inquiryId: initialInquiryId || '',
        customerName: '',
        description: '',
        date: '',
        time: '',
        meetingLink: '',
        notes: ''
    });

    useEffect(() => {
        if (isOpen) {
            loadInquiries();
            setFormData({
                inquiryId: initialInquiryId || '',
                customerName: '',
                description: '',
                date: '',
                time: '',
                meetingLink: '',
                notes: ''
            });
            setSearchInquiry('');
            setShowCustomerDropdown(false);
        }
    }, [isOpen, initialInquiryId]);

    const loadInquiries = async () => {
        try {
            const res = await api.get<Inquiry[]>('/inquiries');
            if (res.success && res.data) {
                setInquiries(res.data);
                if (initialInquiryId) {
                    const found = res.data.find(i => i._id === initialInquiryId);
                    if (found) {
                        setFormData(prev => ({ ...prev, customerName: found.customerName }));
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectInquiry = (inquiry: Inquiry) => {
        setFormData(prev => ({
            ...prev,
            inquiryId: inquiry._id,
            customerName: inquiry.customerName
        }));
        setShowCustomerDropdown(false);
        setSearchInquiry('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerName || !formData.date || !formData.time) {
            alert('Please fill in required fields (Name, Date, Time)');
            return;
        }

        setLoading(true);
        try {
            const scheduledAt = new Date(`${formData.date}T${formData.time}`);

            const payload = {
                inquiryId: formData.inquiryId || undefined,
                customerName: formData.customerName,
                type: 'meeting',
                title: `${formData.customerName} Meeting`,
                description: formData.description,
                meetingLink: formData.meetingLink,
                scheduledAt: scheduledAt.toISOString(),
                notes: formData.notes,
                status: 'schedule'
            };

            const res = await api.post('/reminders', payload);

            if (res.success) {
                onSuccess();
                onClose();
            } else {
                alert('Failed to create meeting');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to create meeting');
        } finally {
            setLoading(false);
        }
    };

    const filteredInquiries = inquiries.filter(inq =>
        inq.customerName.toLowerCase().includes(searchInquiry.toLowerCase()) ||
        (inq.customerId && inq.customerId.toLowerCase().includes(searchInquiry.toLowerCase()))
    );

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Add Meeting</h2>
                    <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
                        <X size={22} />
                    </button>
                </div>

                <div className={styles.formWrap}>
                    <div className={styles.addCustomerWrap}>
                        <button
                            type="button"
                            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                            className={styles.addCustomerBtn}
                        >
                            <Plus size={16} />
                            Add Customer
                        </button>

                        {showCustomerDropdown && (
                            <div className={styles.dropdown}>
                                <div className={styles.dropdownSearch}>
                                    <input
                                        type="text"
                                        placeholder="Search customers..."
                                        value={searchInquiry}
                                        onChange={(e) => setSearchInquiry(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                {filteredInquiries.length > 0 ? (
                                    filteredInquiries.map((inq) => (
                                        <button
                                            key={inq._id}
                                            type="button"
                                            onClick={() => handleSelectInquiry(inq)}
                                            className={styles.dropdownItem}
                                        >
                                            <div className={styles.dropdownItemName}>{inq.customerName}</div>
                                            {inq.customerId && <div className={styles.dropdownItemMeta}>{inq.customerId}</div>}
                                        </button>
                                    ))
                                ) : (
                                    <div className={styles.dropdownEmpty}>No customers found</div>
                                )}
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="customerName">
                                <User size={18} />
                                Name
                            </label>
                            <input
                                id="customerName"
                                type="text"
                                placeholder="Enter Customer Name"
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                className={styles.input}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="description">
                                <FileText size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
                                Description
                            </label>
                            <textarea
                                id="description"
                                placeholder="Add Description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                className={styles.textarea}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>
                                <Calendar size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
                                Date and Time
                            </label>
                            <div className={styles.dateTimeRow}>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className={styles.input}
                                    required
                                />
                                <input
                                    type="time"
                                    value={formData.time}
                                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                                    className={styles.input}
                                    required
                                />
                                <button type="button" className={styles.dateTimeAddBtn}>
                                    <Calendar size={18} />
                                    Add
                                </button>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="meetingLink">
                                <Link2 size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
                                Meeting Link
                            </label>
                            <input
                                id="meetingLink"
                                type="text"
                                placeholder="Add meeting link"
                                value={formData.meetingLink}
                                onChange={e => setFormData({ ...formData, meetingLink: e.target.value })}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="notes">
                                <StickyNote size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
                                Notes
                            </label>
                            <input
                                id="notes"
                                type="text"
                                placeholder="Add notes"
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.actions}>
                            <button type="submit" disabled={loading} className={styles.submitBtn}>
                                {loading ? 'Creating...' : 'Create Meeting'}
                            </button>
                            <button type="button" onClick={onClose} disabled={loading} className={styles.cancelBtn}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
