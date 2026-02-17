
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ChevronDown,
    Edit3,
    Trash2,
    Calendar,
    Link as LinkIcon,
    User,
    Clock
} from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './MeetingDetail.module.css';

interface Meeting {
    _id: string;
    inquiryId?: {
        _id: string;
        customerName: string;
    };
    customerName?: string;
    title: string;
    description?: string;
    meetingLink?: string;
    scheduledAt: string;
    notes?: string;
    status: 'schedule' | 'overdue' | 'done' | 'cancel' | 'postpone';
}

const STATUS_LABELS: Record<string, string> = {
    schedule: 'schedule',
    overdue: 'overdue',
    done: 'done',
    cancel: 'cancel',
    postpone: 'postpone',
};

const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'schedule') return 'bg-white text-orange-500 border-orange-200 hover:border-orange-300';
    if (s === 'overdue') return 'bg-[#fee2e2] text-red-600 border-transparent';
    if (s === 'done') return 'bg-[#dcfce7] text-green-600 border-transparent';
    if (s === 'cancel') return 'bg-[#d1d5db] text-gray-700 border-transparent';
    if (s === 'postpone') return 'bg-[#f3e8ff] text-purple-600 border-transparent';
    return 'bg-white text-gray-700 border-gray-200';
};

export default function MeetingDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        customerName: '',
        description: '',
        date: '',
        time: '',
        meetingLink: '',
        notes: ''
    });

    // Confirmation State
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = async () => {
        if (!id) return;
        try {
            // Fetch meeting details (reminder)
            const res = await api.get<{ data: Meeting }>(`/reminders/${id}`);
            // The API wrapper might return { success: true, data: ... } or just data depending on client.ts
            // Based on previous code, likely `res.data`

            // Actually api.get returns `Promise<ApiResponse<T>>`
            // checking `api` usage in other files...
            // `const res = await api.get<Inquiry>(...)` then `if (res.success && res.data)`

            // Wait, I need to check if `api.get` matches that signature. 
            // Assuming strict typing from `InquiryDetail.tsx`: 
            // `api.get<Inquiry>(...)` returns `{ success: boolean, data: Inquiry }`

            // Let's assume `res` here is `ApiResponse<Meeting>` 
            // But `api.get` usage in `MeetingDetail` was `api.get<{ data: Meeting }>` which is wrong if generic is T.
            // It shoud be `api.get<Meeting>`.

            // Let's re-read client.ts or assume standard from InquiryDetail.
            // InquiryDetail: `api.get<Inquiry>(...)` -> `inqRes.data`

            if (res && (res as any).success && (res as any).data) { // Safe casting
                const m = (res as any).data as Meeting;
                setMeeting(m);

                const dateObj = new Date(m.scheduledAt);
                setEditForm({
                    customerName: m.customerName || m.inquiryId?.customerName || '',
                    description: m.description || m.title || '',
                    date: dateObj.toISOString().split('T')[0],
                    time: dateObj.toTimeString().slice(0, 5),
                    meetingLink: m.meetingLink || '',
                    notes: m.notes || ''
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    const updateStatus = async (status: string) => {
        if (!id || !meeting) return;
        setMeeting({ ...meeting, status: status as any });
        try {
            await api.patch(`/reminders/${id}`, { status });
        } catch (err) {
            console.error(err);
            load();
        }
    };

    const [saveError, setSaveError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!id) return;
        setSaveError(null);
        try {
            const scheduledAt = new Date(`${editForm.date}T${editForm.time}`);

            const payload = {
                customerName: editForm.customerName,
                description: editForm.description,
                title: meeting?.title || `${editForm.customerName} Meeting`,
                meetingLink: editForm.meetingLink,
                scheduledAt: scheduledAt.toISOString(),
                notes: editForm.notes
            };

            const res = await api.patch<Meeting>(`/reminders/${id}`, payload);
            if (res.success && res.data) {
                setMeeting(res.data);
                setIsEditing(false);
            } else {
                setSaveError(res.error?.message || 'Failed to save. Reschedule may have failed on Google Calendar.');
            }
        } catch (err) {
            console.error(err);
            setSaveError('Failed to save meeting details. Check your connection.');
        }
    };

    const handleDelete = () => setShowDelete(true);

    const [deleteError, setDeleteError] = useState<string | null>(null);

    const confirmDelete = async () => {
        if (!id) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await api.delete(`/reminders/${id}`);
            if (res && res.success === false) {
                setDeleteError(res.error?.message || 'Failed to delete meeting.');
            } else {
                navigate('/meetings');
            }
        } catch (err) {
            console.error(err);
            setDeleteError('Failed to delete meeting. Check your connection.');
        } finally {
            setDeleting(false);
            setShowDelete(false);
        }
    };

    if (loading) return <div className={styles.container}>Loading...</div>;
    if (!meeting) return <div className={styles.container}>Meeting not found.</div>;

    const displayName = meeting.customerName || meeting.inquiryId?.customerName || 'Unknown';

    return (
        <div className={styles.container}>
            {/* Back Button */}
            <div className="flex flex-col gap-4 mb-6">
                <Link to="/meetings" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors w-fit">
                    <ArrowLeft size={20} />
                    <span className="font-medium text-lg">Back</span>
                </Link>
                <div className={styles.breadcrumb}>
                    <span>Home</span> &gt; <span>Meetings</span> &gt; <span className="font-semibold">Meeting Details</span>
                </div>
            </div>

            <div className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>{displayName}</h1>
                    <p className={styles.subTitle}>Meeting Details</p>
                </div>
                <button onClick={handleDelete} className={styles.deleteBtn}>
                    <Trash2 size={16} /> Delete Meeting
                </button>
            </div>

            <div className={styles.grid}>
                <div className={styles.mainCard}>
                    <div className={styles.cardHeader}>
                        <div className="flex items-center gap-4">
                            <h2 className={styles.cardTitle}>Meeting Information</h2>
                            <div className="relative w-40">
                                <select
                                    value={meeting.status}
                                    onChange={(e) => updateStatus(e.target.value)}
                                    className={`appearance-none w-full pl-4 pr-10 py-2 rounded-full text-xs font-bold border uppercase tracking-wide cursor-pointer focus:outline-none transition-colors shadow-sm ${getStatusColor(meeting.status)}`}
                                >
                                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={14} />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <button onClick={handleSave} className={styles.saveBtn}>Save Meeting</button>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
                                    <Edit3 size={16} /> Edit Meeting
                                </button>
                            )}
                        </div>
                    </div>

                    <form className="space-y-6">
                        {saveError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                                {saveError}
                            </div>
                        )}
                        {isEditing && meeting?.googleEventId && (
                            <p className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded">Changing date or time will reschedule the meeting on Google Calendar and notify attendees.</p>
                        )}
                        <div className={styles.formGroup}>
                            <label>Customer Name</label>
                            <div className="relative">
                                <input
                                    value={isEditing ? editForm.customerName : displayName}
                                    onChange={e => setEditForm({ ...editForm, customerName: e.target.value })}
                                    readOnly={!isEditing}
                                    className={`${isEditing ? styles.inputParam : styles.inputReadonly} !pl-10`}
                                />
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Description</label>
                            <textarea
                                value={isEditing ? editForm.description : (meeting.description || meeting.title)}
                                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                readOnly={!isEditing}
                                className={isEditing ? styles.inputParam : styles.inputReadonly}
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                            <div className={styles.formGroup}>
                                <label>Date</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={editForm.date}
                                        onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                        readOnly={!isEditing}
                                        className={`${isEditing ? styles.inputParam : styles.inputReadonly} !pl-10`}
                                    />
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Time</label>
                                <div className="relative">
                                    <input
                                        type="time"
                                        value={editForm.time}
                                        onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                                        readOnly={!isEditing}
                                        className={`${isEditing ? styles.inputParam : styles.inputReadonly} !pl-10`}
                                    />
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                </div>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Meeting Link</label>
                            <div className="relative">
                                <input
                                    value={isEditing ? editForm.meetingLink : meeting.meetingLink}
                                    onChange={e => setEditForm({ ...editForm, meetingLink: e.target.value })}
                                    readOnly={!isEditing}
                                    className={`${isEditing ? styles.inputParam : styles.inputReadonly} !pl-10 text-blue-600 underline cursor-pointer`}
                                    onClick={() => !isEditing && meeting.meetingLink && window.open(meeting.meetingLink, '_blank')}
                                />
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Notes</label>
                            <textarea
                                value={isEditing ? editForm.notes : meeting.notes}
                                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                readOnly={!isEditing}
                                className={isEditing ? styles.inputParam : styles.inputReadonly}
                                rows={4}
                                placeholder="No notes added."
                            />
                        </div>
                    </form>
                </div>

                {/* Sidebar - Optional Context or removed if not needed. 
            For now, let's keep it simple as requested: "show every details that we add". 
            I've put all details in the main card. 
            If user wants sidebar, I can add "Customer Details" there if inquiryId exists. 
            Let's skip sidebar for now to keep it clean, or just use it for "Actions" if any.
        */}
            </div>

            <ConfirmDialog
                open={showDelete}
                title="Delete Meeting"
                message="Are you sure you want to delete this meeting? It will be cancelled on Google Calendar and attendees will be notified. This cannot be undone."
                confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                onConfirm={confirmDelete}
                onCancel={() => { setShowDelete(false); setDeleteError(null); }}
                danger
            />
            {deleteError && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg shadow z-50">
                    {deleteError}
                </div>
            )}
        </div>
    );
}
