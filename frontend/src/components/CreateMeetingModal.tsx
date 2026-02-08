import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client';

interface CreateMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialInquiryId?: string;
}

interface Inquiry {
    _id: string;
    customerName: string;
}

export default function CreateMeetingModal({ isOpen, onClose, onSuccess, initialInquiryId }: CreateMeetingModalProps) {
    const [loading, setLoading] = useState(false);
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);

    const [formData, setFormData] = useState({
        inquiryId: initialInquiryId || '',
        title: '',
        description: '',
        date: '',
        time: '',
        notes: ''
    });

    useEffect(() => {
        if (isOpen) {
            // Fetch inquiries for the dropdown
            api.get<Inquiry[]>('/inquiries').then(res => {
                if (res.success && res.data) {
                    setInquiries(res.data);
                }
            });
            // Reset form if opening fresh
            if (!initialInquiryId) {
                setFormData(prev => ({ ...prev, inquiryId: '' }));
            } else {
                setFormData(prev => ({ ...prev, inquiryId: initialInquiryId }));
            }
        }
    }, [isOpen, initialInquiryId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.inquiryId || !formData.title || !formData.date || !formData.time) {
            alert('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const scheduledAt = new Date(`${formData.date}T${formData.time}`);

            const res = await api.post('/reminders', {
                inquiryId: formData.inquiryId,
                type: 'meeting',
                title: formData.title,
                description: formData.description,
                scheduledAt: scheduledAt.toISOString(),
                notes: formData.notes,
                status: 'schedule'
            });

            if (res.success) {
                onSuccess();
                onClose();
                // Reset form
                setFormData({
                    inquiryId: '',
                    title: '',
                    description: '',
                    date: '',
                    time: '',
                    notes: ''
                });
            }
        } catch (err) {
            console.error(err);
            alert('Failed to create meeting');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform transition-all">
                {/* Header */}
                <div className="bg-orange-500 rounded-t-2xl px-6 py-4 flex justify-between items-center text-white">
                    <h2 className="text-xl font-bold">Add Meetings</h2>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Customer/Inquiry Dropdown */}
                        {initialInquiryId ? (
                            <div className="hidden"></div>
                        ) : (
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-gray-700">Customer Name</label>
                                <select
                                    value={formData.inquiryId}
                                    onChange={e => setFormData({ ...formData, inquiryId: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                                >
                                    <option value="">Select Customer</option>
                                    {inquiries.map(inq => (
                                        <option key={inq._id} value={inq._id}>{inq.customerName}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Title / Name */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700">Name</label>
                            <input
                                type="text"
                                placeholder="Enter Meeting Name"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700">Description</label>
                            <textarea
                                placeholder="Add Description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                            />
                        </div>

                        {/* Date and Time */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700">Date and Time</label>
                            <div className="flex gap-4">
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                                />
                                <input
                                    type="time"
                                    value={formData.time}
                                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Notes (Optional based on image, but logical to have) */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700">Notes (Optional)</label>
                            <input
                                type="text"
                                placeholder="Pick a date"
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                            />
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition-colors text-sm disabled:opacity-70"
                            >
                                {loading ? 'Creating...' : 'Create Meeting'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
