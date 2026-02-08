import { useState, useEffect } from 'react';
import { X, Plus, FileText } from 'lucide-react';
import { api } from '../api/client';

interface CreateProposalModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface Inquiry {
    _id: string;
    customerId?: string;
    customerName: string;
    projectDescription: string;
    requiredFeatures: string[];
}

interface Milestone {
    title: string;
    amount: string;
    time: string;
}

export default function CreateProposalModal({ open, onClose, onSuccess }: CreateProposalModalProps) {
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
    const [searchInquiry, setSearchInquiry] = useState('');
    const [showInquiryDropdown, setShowInquiryDropdown] = useState(false);

    const [projectTitle, setProjectTitle] = useState('');
    const [milestones, setMilestones] = useState<Milestone[]>([{ title: '', amount: '', time: '' }]);
    const [advancePayment, setAdvancePayment] = useState('');
    const [projectCost, setProjectCost] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            loadInquiries();
        }
    }, [open]);

    const loadInquiries = async () => {
        try {
            const res = await api.get<Inquiry[]>('/inquiries');
            if (res.success && res.data) {
                setInquiries(res.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectInquiry = (inquiry: Inquiry) => {
        setSelectedInquiry(inquiry);
        setSearchInquiry(inquiry.customerName);
        setShowInquiryDropdown(false);
    };

    const addMilestone = () => {
        setMilestones([...milestones, { title: '', amount: '', time: '' }]);
    };

    const removeMilestone = (index: number) => {
        if (milestones.length > 1) {
            setMilestones(milestones.filter((_, i) => i !== index));
        }
    };

    const updateMilestone = (index: number, field: keyof Milestone, value: string) => {
        const updated = [...milestones];
        updated[index][field] = value;
        setMilestones(updated);
    };

    const calculateTotal = () => {
        const advance = parseFloat(advancePayment) || 0;
        const project = parseFloat(projectCost) || 0;
        return advance + project;
    };

    const handleSubmit = async () => {
        if (!selectedInquiry) {
            alert('Please select an inquiry');
            return;
        }

        if (!projectTitle.trim()) {
            alert('Please enter a project title');
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post('/proposals', {
                inquiryId: selectedInquiry._id,
                projectName: projectTitle,
                milestones: milestones.filter(m => m.title.trim()),
                advancePayment: parseFloat(advancePayment) || 0,
                projectCost: parseFloat(projectCost) || 0,
                totalAmount: calculateTotal()
            });

            if (res.success) {
                onSuccess();
                onClose();
                resetForm();
            } else {
                alert('Failed to create proposal');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to create proposal');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setSelectedInquiry(null);
        setSearchInquiry('');
        setProjectTitle('');
        setMilestones([{ title: '', amount: '', time: '' }]);
        setAdvancePayment('');
        setProjectCost('');
    };

    const filteredInquiries = inquiries.filter(inq =>
        inq.customerName.toLowerCase().includes(searchInquiry.toLowerCase()) ||
        (inq.customerId && inq.customerId.toLowerCase().includes(searchInquiry.toLowerCase()))
    );

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                            <span>Home</span>
                            <span>›</span>
                            <span>Proposal</span>
                            <span>›</span>
                            <span className="text-gray-900 font-medium">Create Proposal</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Create Proposal</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-8 py-6 space-y-8">
                    {/* Inquiries Reference Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <FileText size={20} className="text-primary" />
                            <h3 className="text-lg font-bold text-gray-900">Inquiries Reference Details</h3>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                            <div className="relative">
                                <button
                                    onClick={() => setShowInquiryDropdown(!showInquiryDropdown)}
                                    className="w-full bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={16} />
                                    Add Customer
                                </button>

                                {showInquiryDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                                        <div className="p-2 border-b border-gray-200">
                                            <input
                                                type="text"
                                                placeholder="Search inquiries..."
                                                value={searchInquiry}
                                                onChange={(e) => setSearchInquiry(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-primary"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            {filteredInquiries.map((inq) => (
                                                <button
                                                    key={inq._id}
                                                    onClick={() => handleSelectInquiry(inq)}
                                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                                                >
                                                    <div className="font-medium text-gray-900">{inq.customerName}</div>
                                                    {inq.customerId && <div className="text-xs text-gray-500">{inq.customerId}</div>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedInquiry && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={selectedInquiry.customerName}
                                            disabled
                                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Id</label>
                                        <input
                                            type="text"
                                            value={selectedInquiry.customerId || 'N/A'}
                                            disabled
                                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea
                                            value={selectedInquiry.projectDescription}
                                            disabled
                                            rows={3}
                                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-500 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Required Features</label>
                                        <textarea
                                            value={selectedInquiry.requiredFeatures.join(', ')}
                                            disabled
                                            rows={2}
                                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-500 resize-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* General Information */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <FileText size={20} className="text-primary" />
                            <h3 className="text-lg font-bold text-gray-900">General Information</h3>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                                <input
                                    type="text"
                                    value={projectTitle}
                                    onChange={(e) => setProjectTitle(e.target.value)}
                                    placeholder="Enter Project Title"
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Milestones */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <FileText size={20} className="text-primary" />
                            <h3 className="text-lg font-bold text-gray-900">Milestones</h3>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-700">
                                <div>Title</div>
                                <div>Amount</div>
                                <div>Time</div>
                            </div>

                            {milestones.map((milestone, index) => (
                                <div key={index} className="grid grid-cols-3 gap-4 items-start">
                                    <input
                                        type="text"
                                        value={milestone.title}
                                        onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                                        placeholder="Enter Project Title"
                                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                                    />
                                    <input
                                        type="number"
                                        value={milestone.amount}
                                        onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                                        placeholder="Optional"
                                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={milestone.time}
                                            onChange={(e) => updateMilestone(index, 'time', e.target.value)}
                                            placeholder="Optional"
                                            className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                                        />
                                        {milestones.length > 1 && (
                                            <button
                                                onClick={() => removeMilestone(index)}
                                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={addMilestone}
                                className="text-primary hover:text-primary-hover font-medium text-sm flex items-center gap-1"
                            >
                                <Plus size={16} />
                                Add another Milestones
                            </button>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <FileText size={20} className="text-primary" />
                            <h3 className="text-lg font-bold text-gray-900">Pricing</h3>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Payment</label>
                                <input
                                    type="number"
                                    value={advancePayment}
                                    onChange={(e) => setAdvancePayment(e.target.value)}
                                    placeholder="Add advance payment"
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Cost</label>
                                <input
                                    type="number"
                                    value={projectCost}
                                    onChange={(e) => setProjectCost(e.target.value)}
                                    placeholder="Enter Project Cost"
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-300">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Total Cost</span>
                                </div>
                                <div className="bg-white border-2 border-primary rounded-lg px-6 py-4 text-center">
                                    <div className="text-3xl font-bold text-primary">
                                        LKR. {calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || !selectedInquiry}
                            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Creating...' : 'Create Proposal'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
