import { useState, useEffect } from 'react';
import { Plus, Search, FileText, Share2, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import CreateMeetingModal from '../components/CreateMeetingModal';
import styles from './Inquiries.module.css'; // Reusing table styles

interface Meeting {
    _id: string;
    inquiryId: {
        _id: string;
        customerName: string;
    };
    title: string;
    description?: string;
    scheduledAt: string;
    status: 'schedule' | 'overdue' | 'done' | 'cancel' | 'postpone';
}

export default function Meetings() {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

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
        if (res?.success !== false) load();
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

    const filteredMeetings = meetings.filter(m =>
        (m.inquiryId?.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        m.title.toLowerCase().includes(search.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'schedule': return 'text-orange-500 border-orange-500';
            case 'overdue': return 'text-red-500 border-red-500';
            case 'done': return 'text-green-500 border-green-500';
            case 'cancel': return 'text-gray-500 border-gray-500';
            default: return 'text-gray-500 border-gray-500';
        }
    }

    return (
        <div className="space-y-6 font-sans">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                >
                    <Plus size={18} />
                    Add Meetings
                </button>
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by Name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    />
                </div>
            </div>

            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className="px-6 py-4 w-[20%] text-orange-600 font-bold uppercase text-xs tracking-wider">Customer Name</th>
                            <th className="px-6 py-4 w-[20%] text-orange-600 font-bold uppercase text-xs tracking-wider">Description</th>
                            <th className="px-6 py-4 w-[20%] text-orange-600 font-bold uppercase text-xs tracking-wider">Date and Time</th>
                            <th className="px-6 py-4 w-[15%] text-orange-600 font-bold uppercase text-xs tracking-wider text-center">Status</th>
                            <th className="px-6 py-4 w-[15%] text-orange-600 font-bold uppercase text-xs tracking-wider text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-0">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : (
                            <>
                                {filteredMeetings.map((m) => (
                                    <tr
                                        key={m._id}
                                        className="h-[75px] hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {m.inquiryId?.customerName || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-bold text-xs">{m.title}</td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(m.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <div className="relative inline-block">
                                                <select
                                                    value={m.status}
                                                    onChange={(e) => handleStatusChange(m._id, e.target.value)}
                                                    className={`appearance-none bg-white border rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider cursor-pointer focus:outline-none ${getStatusColor(m.status)}`}
                                                >
                                                    <option value="schedule">schedule</option>
                                                    <option value="overdue">overdue</option>
                                                    <option value="done">done</option>
                                                    <option value="cancel">cancel</option>
                                                    <option value="postpone">postpone</option>
                                                </select>
                                                {/* Custom arrow could go here if we hide default appearance */}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center items-center gap-4">
                                                <button className="text-gray-900 hover:text-orange-500 transition-colors">
                                                    <FileText size={20} />
                                                </button>
                                                <button className="text-gray-900 hover:text-orange-500 transition-colors">
                                                    <Share2 size={20} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteId(m._id)}
                                                    className="text-gray-900 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {/* Fill remaining rows */}
                                {Array.from({ length: Math.max(0, 8 - filteredMeetings.length) }).map((_, idx) => (
                                    <tr key={`empty-${idx}`} className="h-[75px]">
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
                        <select className="bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-orange-300">
                            <option>10</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>1-5 of 5</span>
                        <div className="flex gap-1">
                            <button className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50" disabled>&lt; Previous</button>
                            <button className="px-2 py-1 border border-gray-300 rounded hover:bg-white">Next &gt;</button>
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
