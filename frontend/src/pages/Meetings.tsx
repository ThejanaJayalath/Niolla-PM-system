import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ChevronDown, ExternalLink, Copy, Check, X } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import CreateMeetingModal from '../components/CreateMeetingModal';
import styles from './Inquiries.module.css'; // Reusing table styles

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
    status: 'schedule' | 'overdue' | 'done' | 'cancel' | 'postpone';
}

const STATUS_LABELS: Record<string, string> = {
    schedule: 'schedule',
    overdue: 'overdue',
    done: 'done',
    cancel: 'cancel',
    postpone: 'postpone',
};

export default function Meetings() {
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const load = async () => {
        try {
            // Fetch upcoming meetings (we might need a specific endpoint or filter)
            // For now using upcoming reminders with type=meeting
            const res = await api.get<Meeting[]>('/reminders/upcoming?limit=100&type=meeting');
            if (res.success && res.data) {
                setMeetings(res.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        const res = await api.delete(`/reminders/${deleteId}`);
        setDeleting(false);
        setDeleteId(null);
        if (res && res.success === false) {
            showNotification(res.error?.message || 'Failed to delete meeting', 'error');
        } else {
            load();
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        // Optimistic update
        setMeetings(prev => prev.map(m => m._id === id ? { ...m, status: newStatus as any } : m));

        try {
            await api.patch(`/reminders/${id}`, { status: newStatus });
        } catch (err) {
            console.error(err);
            // Revert or reload on error
            load();
        }
    }

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(8);

    const filteredMeetings = meetings.filter(m =>
        (m.customerName || m.inquiryId?.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.description || m.title).toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredMeetings.length / rowsPerPage);
    const paginatedMeetings = filteredMeetings.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'schedule') return 'bg-white text-orange-500 border-orange-200 hover:border-orange-300';
        if (s === 'overdue') return 'bg-[#fee2e2] text-red-600 border-transparent';
        if (s === 'done') return 'bg-[#dcfce7] text-green-600 border-transparent';
        if (s === 'cancel') return 'bg-[#d1d5db] text-gray-700 border-transparent';
        if (s === 'postpone') return 'bg-[#f3e8ff] text-purple-600 border-transparent';
        return 'bg-white text-gray-700 border-gray-200';
    }

    return (
        <div className={`${styles.page} font-sans`}>
            {notification && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-fade-in-down">
                    {notification.type === 'success' ? (
                        <Check size={18} className="text-green-400" />
                    ) : (
                        <X size={18} className="text-red-400" />
                    )}
                    <span className="text-sm font-medium">{notification.message}</span>
                </div>
            )}

            <div className={styles.headerRow}>
                <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                >
                    <Plus size={18} />
                    Add Meetings
                </button>
            </div>

            <div className={styles.filtersRow}>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by Name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className="px-6 py-4 w-[20%] text-orange-500 font-bold text-sm">Customer Name</th>
                            <th className="px-6 py-4 w-[25%] text-orange-500 font-bold text-sm">Description</th>
                            <th className="px-6 py-4 w-[20%] text-orange-500 font-bold text-sm">Date and Time</th>
                            <th className="px-6 py-4 w-[15%] text-orange-500 font-bold text-sm !text-center">Status</th>
                            <th className="px-6 py-4 w-[20%] text-orange-500 font-bold text-sm !text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-0">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : (
                            <>
                                {paginatedMeetings.map((m) => (
                                    <tr
                                        key={m._id}
                                        onClick={() => navigate(`/meetings/${m._id}`)}
                                        className="h-[60px] hover:bg-gray-50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {m.customerName || m.inquiryId?.customerName || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-900 font-medium text-xs truncate max-w-xs" title={m.description || m.title}>
                                            {m.description || m.title}
                                        </td>
                                        <td className="px-6 py-4 text-gray-900 text-xs">
                                            {new Date(m.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            <span className="ml-2">
                                                {new Date(m.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="relative w-40 mx-auto">
                                                <select
                                                    value={m.status}
                                                    onChange={(e) => handleStatusChange(m._id, e.target.value)}
                                                    className={`appearance-none w-full pl-4 pr-10 py-2 rounded-full text-xs font-bold border uppercase tracking-wide cursor-pointer focus:outline-none transition-colors shadow-sm ${getStatusColor(m.status)}`}
                                                >
                                                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                                        <option key={value} value={value}>{label}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={14} />
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center">

                                            <div className="flex justify-center items-center gap-4">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (m.meetingLink) window.open(m.meetingLink, '_blank');
                                                        else showNotification('No meeting link available', 'error');
                                                    }}
                                                    className="text-gray-900 hover:text-primary transition-colors"
                                                    title="Open Meeting Link"
                                                >
                                                    <ExternalLink size={20} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (m.meetingLink) {
                                                            navigator.clipboard.writeText(m.meetingLink);
                                                            showNotification('Meeting link copied to clipboard', 'success');
                                                        } else {
                                                            showNotification('No meeting link to copy', 'error');
                                                        }
                                                    }}
                                                    className="text-gray-900 hover:text-primary transition-colors"
                                                    title="Copy Meeting Link"
                                                >
                                                    <Copy size={20} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteId(m._id);
                                                    }}
                                                    className="text-gray-900 hover:text-red-600 transition-colors"
                                                    title="Delete Meeting"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {/* Fill remaining rows */}
                                {Array.from({ length: Math.max(0, rowsPerPage - paginatedMeetings.length) }).map((_, idx) => (
                                    <tr key={`empty-${idx}`} className="h-[60px]">
                                        <td className="px-6 py-4">&nbsp;</td>
                                        <td className="px-6 py-4">&nbsp;</td>
                                        <td className="px-6 py-4">&nbsp;</td>
                                        <td className="px-6 py-4">&nbsp;</td>
                                        <td className="px-6 py-4">&nbsp;</td>
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>

                {/* Pagination footer (Visual only for now matching Proposals) */}
                <div className="px-6 py-3 bg-[#f9fafb] border-t border-[#fed7aa] flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                        <span>Rows Per Page:</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-orange-300"
                        >
                            <option value={8}>8</option>
                            <option value={16}>16</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>
                            {filteredMeetings.length === 0 ? '0-0 of 0' : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, filteredMeetings.length)} of ${filteredMeetings.length}`}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                &lt;
                            </button>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                &gt;
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <CreateMeetingModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={load}
            />

            <ConfirmDialog
                open={!!deleteId}
                title="Delete Meeting"
                message="Are you sure you want to delete this meeting?"
                confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                cancelLabel="Cancel"
                danger
                onConfirm={handleDelete}
                onCancel={() => !deleting && setDeleteId(null)}
            />
        </div>
    );
}
