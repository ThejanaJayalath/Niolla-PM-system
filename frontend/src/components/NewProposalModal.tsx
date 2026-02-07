
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search } from 'lucide-react';
import { api } from '../api/client';

interface NewProposalModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface Milestone {
    title: string;
    amount: number;
    timePeriod?: string;
}

interface Maintenance {
    title: string;
    cost: number;
    description?: string;
}

interface Inquiry {
    _id: string;
    customerName: string;
    projectDescription: string;
}

export default function NewProposalModal({ open, onClose, onSuccess }: NewProposalModalProps) {
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [searchInq, setSearchInq] = useState('');
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

    const [projectName, setProjectName] = useState('');
    const [milestones, setMilestones] = useState<Milestone[]>([{ title: '', amount: 0 }]);
    const [maintenanceItems, setMaintenanceItems] = useState<Maintenance[]>([{ title: '', cost: 0 }]);

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            loadInquiries();
        }
    }, [open]);

    const loadInquiries = async () => {
        setLoading(true);
        try {
            const res = await api.get<Inquiry[]>('/inquiries?status=NEW');
            if (res.success && res.data) {
                setInquiries(res.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const totalMilestoneAmount = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const totalMaintenance = maintenanceItems.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);

    const handleSubmit = async () => {
        if (!selectedInquiry) return alert('Please select an inquiry');

        setSubmitting(true);
        try {
            const maintenanceNote = maintenanceItems
                .filter(m => m.title)
                .map(m => `${m.title}: ${m.cost} (${m.description || ''})`)
                .join('\n');

            const res = await api.post('/proposals', {
                inquiryId: selectedInquiry._id,
                projectName,
                milestones,
                totalAmount: totalMilestoneAmount,
                maintenanceCostPerMonth: totalMaintenance,
                maintenanceNote,
                notes: 'Created via Proposal Tab'
            });

            if (res.success) {
                onSuccess();
                onClose();
            } else {
                alert('Failed: ' + (res.error?.message || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Error creating proposal');
        } finally {
            setSubmitting(false);
        }
    };

    const addMilestone = () => setMilestones([...milestones, { title: '', amount: 0 }]);
    const removeMilestone = (idx: number) => setMilestones(milestones.filter((_, i) => i !== idx));
    const updateMilestone = (idx: number, field: keyof Milestone, value: any) => {
        const newM = [...milestones];
        newM[idx] = { ...newM[idx], [field]: value };
        setMilestones(newM);
    };

    const addMaintenance = () => setMaintenanceItems([...maintenanceItems, { title: '', cost: 0 }]);
    const removeMaintenance = (idx: number) => setMaintenanceItems(maintenanceItems.filter((_, i) => i !== idx));
    const updateMaintenance = (idx: number, field: keyof Maintenance, value: any) => {
        const newItems = [...maintenanceItems];
        newItems[idx] = { ...newItems[idx], [field]: value };
        setMaintenanceItems(newItems);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Create New Proposal</h2>
                        <p className="text-sm text-gray-500 mt-1">Fill in the details below to generate a proposal</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* 1. Select Inquiry */}
                    <section className="space-y-4">
                        <label className="block text-sm font-bold text-gray-900">Select Inquiry</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search inquiry by customer name..."
                                value={searchInq}
                                onChange={e => setSearchInq(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                            {/* Dropdown results */}
                            {searchInq && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
                                    {loading ? (
                                        <div className="px-4 py-3 text-sm text-gray-500">Loading inquiries...</div>
                                    ) : inquiries.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-gray-500">No inquiries found</div>
                                    ) : (
                                        inquiries
                                            .filter(i => i.customerName.toLowerCase().includes(searchInq.toLowerCase()))
                                            .map(inq => (
                                                <div
                                                    key={inq._id}
                                                    onClick={() => { setSelectedInquiry(inq); setSearchInq(inq.customerName); }}
                                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                >
                                                    <div className="font-medium text-gray-900">{inq.customerName}</div>
                                                    <div className="text-xs text-gray-500 truncate">{inq.projectDescription}</div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            )}
                        </div>
                        {selectedInquiry && (
                            <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3">
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-green-900">Selected: {selectedInquiry.customerName}</div>
                                    <div className="text-xs text-green-700 mt-1">{selectedInquiry.projectDescription}</div>
                                </div>
                                <button onClick={() => { setSelectedInquiry(null); setSearchInq(''); }} className="text-green-700 hover:text-green-900"><X size={16} /></button>
                            </div>
                        )}
                    </section>

                    {/* 2. Project Name */}
                    <section className="space-y-4">
                        <label className="block text-sm font-bold text-gray-900">Project Name</label>
                        <input
                            type="text"
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            placeholder="e.g. E-commerce Platform Redesign"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-all"
                        />
                    </section>

                    {/* 3. Milestones */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-gray-900">Milestones</label>
                            <button onClick={addMilestone} className="text-sm text-primary font-bold hover:underline flex items-center gap-1">
                                <Plus size={16} /> Add Milestone
                            </button>
                        </div>
                        <div className="space-y-3">
                            {milestones.map((m, idx) => (
                                <div key={idx} className="flex gap-3 items-start">
                                    <div className="flex-1 space-y-1">
                                        <input
                                            placeholder="Title"
                                            value={m.title}
                                            onChange={e => updateMilestone(idx, 'title', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div className="w-32 space-y-1">
                                        <input
                                            type="number"
                                            placeholder="Amount"
                                            value={m.amount}
                                            onChange={e => updateMilestone(idx, 'amount', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div className="w-32 space-y-1">
                                        <input
                                            placeholder="Time (opt)"
                                            value={m.timePeriod}
                                            onChange={e => updateMilestone(idx, 'timePeriod', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-primary outline-none"
                                        />
                                    </div>
                                    <button onClick={() => removeMilestone(idx)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end text-sm font-bold text-gray-900">
                            Total Milestones: Rs. {totalMilestoneAmount.toLocaleString()}
                        </div>
                    </section>

                    {/* 4. Deployment & Maintenance */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-gray-900">Deployment, Maintain & Publication</label>
                            <button onClick={addMaintenance} className="text-sm text-primary font-bold hover:underline flex items-center gap-1">
                                <Plus size={16} /> Add Item
                            </button>
                        </div>
                        <div className="space-y-3">
                            {maintenanceItems.map((m, idx) => (
                                <div key={idx} className="flex gap-3 items-start">
                                    <div className="flex-1 space-y-1">
                                        <input
                                            placeholder="Title (e.g. Server Cost)"
                                            value={m.title}
                                            onChange={e => updateMaintenance(idx, 'title', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div className="w-32 space-y-1">
                                        <input
                                            type="number"
                                            placeholder="Cost"
                                            value={m.cost}
                                            onChange={e => updateMaintenance(idx, 'cost', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div className="w-48 space-y-1">
                                        <input
                                            placeholder="Description (opt)"
                                            value={m.description}
                                            onChange={e => updateMaintenance(idx, 'description', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-primary outline-none"
                                        />
                                    </div>
                                    <button onClick={() => removeMaintenance(idx)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end text-sm font-bold text-gray-900">
                            Total Maintenance: Rs. {totalMaintenance.toLocaleString()}
                        </div>
                    </section>

                    {/* 5. Total Price Display */}
                    <section className="p-6 bg-gray-50 rounded-xl space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-500">Total Project Price (Milestones)</span>
                            <span className="text-2xl font-black text-gray-900">Rs. {totalMilestoneAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="text-xs font-bold text-gray-500">Monthly Maintenance</span>
                            <span className="text-lg font-bold text-gray-700">Rs. {totalMaintenance.toLocaleString()}/mo</span>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => window.open('https://example.com/demo', '_blank')}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                        View Demo
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-hover shadow-lg shadow-orange-200 transition-all transform hover:-translate-y-0.5"
                    >
                        {submitting ? 'Creating...' : 'Create Proposal'}
                    </button>
                </div>
            </div>
        </div>
    );
}
