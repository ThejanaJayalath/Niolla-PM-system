import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Plus, Calendar, User, FileText, StickyNote, Mail, Repeat, Users } from 'lucide-react';
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

interface TeamMember {
    _id: string;
    name: string;
    email: string;
}

const RECURRENCE_OPTIONS: { value: '' | string; label: string; rrule?: string }[] = [
    { value: '', label: 'None' },
    { value: 'daily5', label: 'Daily (5 times)', rrule: 'RRULE:FREQ=DAILY;COUNT=5' },
    { value: 'weekly5', label: 'Weekly (5 times)', rrule: 'RRULE:FREQ=WEEKLY;COUNT=5' },
    { value: 'monthly3', label: 'Monthly (3 times)', rrule: 'RRULE:FREQ=MONTHLY;COUNT=3' },
];

export default function CreateMeetingModal({ isOpen, onClose, onSuccess, initialInquiryId }: CreateMeetingModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [searchInquiry, setSearchInquiry] = useState('');
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
    const [showTeamMemberDropdown, setShowTeamMemberDropdown] = useState(false);
    const [searchTeamMember, setSearchTeamMember] = useState('');

    const [formData, setFormData] = useState({
        inquiryId: initialInquiryId || '',
        customerName: '',
        description: '',
        date: '',
        time: '',
        durationMinutes: 60,
        notes: '',
        attendeesText: '',
        sendInvites: true,
        recurrence: '',
    });
    const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (isOpen) {
            loadInquiries();
            loadTeamMembers();
            setFormData({
                inquiryId: initialInquiryId || '',
                customerName: '',
                description: '',
                date: '',
                time: '',
                durationMinutes: 60,
                notes: '',
                attendeesText: '',
                sendInvites: true,
                recurrence: '',
            });
            setError(null);
            setErrorCode(undefined);
            setSearchInquiry('');
            setShowCustomerDropdown(false);
            setSelectedTeamMemberIds([]);
            setShowTeamMemberDropdown(false);
            setSearchTeamMember('');
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

    const loadTeamMembers = async () => {
        try {
            const res = await api.get<TeamMember[]>('/users');
            if (res.success && res.data) {
                setTeamMembers(res.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleTeamMember = (member: TeamMember) => {
        const emailLower = member.email.trim().toLowerCase();
        const currentEmails = parseAttendees(formData.attendeesText);
        const isSelected = selectedTeamMemberIds.includes(member._id);

        if (isSelected) {
            setSelectedTeamMemberIds(prev => prev.filter(id => id !== member._id));
            setFormData(prev => ({
                ...prev,
                attendeesText: currentEmails.filter(e => e !== emailLower).join('\n'),
            }));
        } else {
            setSelectedTeamMemberIds(prev => [...prev, member._id]);
            if (!currentEmails.includes(emailLower)) {
                setFormData(prev => ({
                    ...prev,
                    attendeesText: (prev.attendeesText.trim() ? prev.attendeesText.trim() + '\n' : '') + member.email,
                }));
            }
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

    const parseAttendees = (text: string): string[] => {
        return text
            .split(/[\n,;]+/)
            .map(e => e.trim().toLowerCase())
            .filter(e => e && e.includes('@'));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerName || !formData.date || !formData.time) {
            setError('Please fill in required fields (Name, Date, Time)');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const scheduledAt = new Date(`${formData.date}T${formData.time}`);
            const attendees = parseAttendees(formData.attendeesText);
            const recurrenceOption = RECURRENCE_OPTIONS.find(o => o.value === formData.recurrence);
            const recurrence = recurrenceOption?.rrule ? [recurrenceOption.rrule] : undefined;

            const payload = {
                inquiryId: formData.inquiryId || undefined,
                customerName: formData.customerName,
                type: 'meeting',
                title: `${formData.customerName} Meeting`,
                description: formData.description,
                scheduledAt: scheduledAt.toISOString(),
                notes: formData.notes,
                status: 'schedule',
                meetingDurationMinutes: formData.durationMinutes,
                attendees: attendees.length > 0 ? attendees : undefined,
                sendInvites: formData.sendInvites && attendees.length > 0,
                recurrence,
            };

            const res = await api.post('/reminders', payload);

            if (res.success) {
                onSuccess();
                onClose();
            } else {
                setError(res.error?.message || 'Failed to create meeting');
                setErrorCode(res.error?.code);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to create meeting. Check your connection and try again.');
            setErrorCode(undefined);
        } finally {
            setLoading(false);
        }
    };

    const filteredInquiries = inquiries.filter(inq =>
        inq.customerName.toLowerCase().includes(searchInquiry.toLowerCase()) ||
        (inq.customerId && inq.customerId.toLowerCase().includes(searchInquiry.toLowerCase()))
    );

    const filteredTeamMembers = teamMembers.filter(m =>
        m.name.toLowerCase().includes(searchTeamMember.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTeamMember.toLowerCase())
    );

    // Keep selected team members in sync when user edits the attendees textarea
    useEffect(() => {
        if (!isOpen || teamMembers.length === 0) return;
        const emailsInText = parseAttendees(formData.attendeesText);
        const ids = teamMembers
            .filter(m => emailsInText.includes(m.email.trim().toLowerCase()))
            .map(m => m._id);
        setSelectedTeamMemberIds(prev =>
            prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids
        );
    }, [formData.attendeesText, isOpen, teamMembers]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
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
                                        onChange={e => setSearchInquiry(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                {filteredInquiries.length > 0 ? (
                                    filteredInquiries.map(inq => (
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
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
                                {error}
                                {errorCode === 'GOOGLE_MEET_ERROR' && (
                                    <div className="mt-2">
                                        <Link
                                            to="/settings"
                                            onClick={() => onClose()}
                                            className="font-medium underline hover:no-underline"
                                        >
                                            Reconnect Google Calendar in Settings →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}

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
                                rows={3}
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
                                <select
                                    value={formData.durationMinutes}
                                    onChange={e => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                                    className={styles.input}
                                    title="Duration"
                                >
                                    <option value={30}>30 min</option>
                                    <option value={60}>1 hr</option>
                                    <option value={90}>1.5 hr</option>
                                    <option value={120}>2 hr</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>
                                <Users size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
                                Team members
                            </label>
                            <div className={styles.addCustomerWrap}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowTeamMemberDropdown(!showTeamMemberDropdown);
                                        setShowCustomerDropdown(false);
                                    }}
                                    className={styles.addCustomerBtn}
                                >
                                    <Plus size={16} />
                                    {selectedTeamMemberIds.length > 0
                                        ? `${selectedTeamMemberIds.length} team member(s) selected`
                                        : 'Select team members'}
                                </button>
                                {showTeamMemberDropdown && (
                                    <div className={styles.dropdown}>
                                        <div className={styles.dropdownSearch}>
                                            <input
                                                type="text"
                                                placeholder="Search team members..."
                                                value={searchTeamMember}
                                                onChange={e => setSearchTeamMember(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        {filteredTeamMembers.length > 0 ? (
                                            filteredTeamMembers.map(member => (
                                                <button
                                                    key={member._id}
                                                    type="button"
                                                    onClick={() => handleToggleTeamMember(member)}
                                                    className={styles.dropdownItem}
                                                >
                                                    <div className={styles.dropdownItemName}>
                                                        {member.name}
                                                        {selectedTeamMemberIds.includes(member._id) && ' ✓'}
                                                    </div>
                                                    <div className={styles.dropdownItemMeta}>{member.email}</div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className={styles.dropdownEmpty}>No team members found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="attendees">
                                <Mail size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
                                Attendees (emails)
                            </label>
                            <textarea
                                id="attendees"
                                placeholder="One email per line or comma-separated"
                                value={formData.attendeesText}
                                onChange={e => setFormData({ ...formData, attendeesText: e.target.value })}
                                rows={2}
                                className={styles.textarea}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.sendInvites}
                                    onChange={e => setFormData({ ...formData, sendInvites: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                                <span>Send email invitations to attendees</span>
                            </label>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="recurrence">
                                <Repeat size={18} style={{ color: 'var(--color-primary, #FB8C19)' }} />
                                Recurrence
                            </label>
                            <select
                                id="recurrence"
                                value={formData.recurrence}
                                onChange={e => setFormData({ ...formData, recurrence: e.target.value })}
                                className={styles.input}
                            >
                                {RECURRENCE_OPTIONS.map(opt => (
                                    <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
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

                        <p className="text-xs text-gray-500 mb-4">
                            A Google Meet link will be created automatically.
                        </p>

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
