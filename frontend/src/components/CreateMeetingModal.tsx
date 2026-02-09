import { useState, useEffect } from 'react';
import { X, Plus, Calendar } from 'lucide-react';
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
            // Reset form
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
                inquiryId: formData.inquiryId || undefined, // Optional
                customerName: formData.customerName,
                type: 'meeting',
                title: `${formData.customerName} Meeting`, // Backend requires title
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-primary px-6 py-4 flex items-center justify-between">
                    <h2 className="text-white text-lg font-semibold">Add Meetings</h2>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Add Customer Button (Top Right relative to form area) */}
                    <div className="flex justify-end mb-4 relative">
                        <button
                            type="button"
                            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                            className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Add Customer
                        </button>

                        {/* Dropdown */}
                        {showCustomerDropdown && (
                            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 w-72 max-h-60 overflow-y-auto">
                                <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                    <input
                                        type="text"
                                        placeholder="Search customers..."
                                        value={searchInquiry}
                                        onChange={(e) => setSearchInquiry(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-primary"
                                        autoFocus
                                    />
                                </div>
                                {filteredInquiries.length > 0 ? (
                                    filteredInquiries.map((inq) => (
                                        <button
                                            key={inq._id}
                                            onClick={() => handleSelectInquiry(inq)}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                                        >
                                            <div className="font-medium text-gray-900 text-sm">{inq.customerName}</div>
                                            {inq.customerId && <div className="text-xs text-gray-500">{inq.customerId}</div>}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">No customers found</div>
                                )}
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Name (Customer Name) */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 block ml-0.5">Name</label>
                            <input
                                type="text"
                                placeholder="Enter Customer Name"
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 block ml-0.5">Description</label>
                            <textarea
                                placeholder="Add Description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400 resize-none"
                            />
                        </div>

                        {/* Date and Time */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 block ml-0.5">Date and Time</label>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-gray-600 appearance-none"
                                        placeholder="Add Date"
                                    />
                                </div>
                                <div className="relative flex-1">
                                    <input
                                        type="time"
                                        value={formData.time}
                                        onChange={e => setFormData({ ...formData, time: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-gray-600 appearance-none"
                                        placeholder="Add Time"
                                    />
                                    {/* Mock Add button/icon if needed, but native inputs have pickers */}
                                </div>
                                <button type="button" className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 rounded-xl flex items-center justify-center font-bold text-sm h-[46px] mt-0.5 shadow-sm transition-colors">
                                    <Calendar size={18} className="mr-2" />
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Meeting Link */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 block ml-0.5">Meeting Link</label>
                            <input
                                type="text"
                                placeholder="Add meetings link"
                                value={formData.meetingLink}
                                onChange={e => setFormData({ ...formData, meetingLink: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400"
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 block ml-0.5">Notes</label>
                            <input
                                type="text"
                                placeholder="pick a date"
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder-gray-400"
                            />
                        </div>

                        {/* Submit */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-orange-200 transition-all active:scale-[0.98]"
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
