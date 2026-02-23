import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Info, Flag, DollarSign, Trash2, Upload, Check } from 'lucide-react';
import { api } from '../api/client';

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

export default function CreateProposal() {
    const navigate = useNavigate();
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
    const [searchInquiry, setSearchInquiry] = useState('');
    const [showInquiryDropdown, setShowInquiryDropdown] = useState(false);

    const [projectTitle, setProjectTitle] = useState('');
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [advancePayment, setAdvancePayment] = useState('');
    const [projectCost, setProjectCost] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [templateInfo, setTemplateInfo] = useState<{ hasTemplate: boolean; fileName?: string }>({ hasTemplate: false });
    const [templateUploading, setTemplateUploading] = useState(false);
    const [templateError, setTemplateError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const location = useLocation();

    useEffect(() => {
        loadInquiries();
        loadTemplateInfo();
    }, []);

    const loadTemplateInfo = async () => {
        const res = await api.getProposalTemplateInfo();
        if (res.success && res.data) {
            setTemplateInfo({
                hasTemplate: res.data.hasTemplate,
                fileName: res.data.fileName,
            });
        }
    };

    const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.toLowerCase();
        if (!ext.endsWith('.docx')) {
            setTemplateError('Only .docx (Word) files are allowed.');
            return;
        }
        setTemplateError(null);
        setTemplateUploading(true);
        const res = await api.uploadTemplate(file);
        setTemplateUploading(false);
        if (res.success) {
            await loadTemplateInfo();
        } else {
            setTemplateError(res.error?.message || 'Upload failed');
        }
        e.target.value = '';
    };

    const loadInquiries = async () => {
        try {
            const res = await api.get<Inquiry[]>('/inquiries');
            if (res.success && res.data) {
                setInquiries(res.data);

                // Check for pre-selected inquiry from navigation state
                const preSelectedId = location.state?.inquiryId;
                if (preSelectedId) {
                    const found = res.data.find(i => i._id === preSelectedId);
                    if (found) {
                        handleSelectInquiry(found);
                    }
                }
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

        const mappedMilestones = milestones
            .filter(m => m.title.trim())
            .map(m => ({
                title: m.title.trim(),
                amount: m.amount ? parseFloat(m.amount) : undefined,
                timePeriod: m.time?.trim() || undefined
            }));

        setSubmitting(true);
        try {
            const res = await api.post('/proposals', {
                inquiryId: selectedInquiry._id,
                projectName: projectTitle,
                milestones: mappedMilestones,
                advancePayment: parseFloat(advancePayment) || 0,
                projectCost: parseFloat(projectCost) || 0,
                totalAmount: calculateTotal()
            });

            if (res.success) {
                navigate('/proposals');
            } else {
                alert(res.error?.message || 'Failed to create proposal');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to create proposal');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredInquiries = inquiries.filter(inq =>
        inq.customerName.toLowerCase().includes(searchInquiry.toLowerCase()) ||
        (inq.customerId && inq.customerId.toLowerCase().includes(searchInquiry.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Content */}
            <div className="max-w-7xl mx-auto px-8 py-8">
                {/* Header */}
                <div className="flex flex-col gap-4 mb-6">
                    <button
                        onClick={() => navigate('/proposals')}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors w-fit"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium text-lg">Back</span>
                    </button>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>Home</span>
                        <span>&gt;</span>
                        <span>Proposal</span>
                        <span>&gt;</span>
                        <span className="font-semibold text-gray-500">Create Proposal</span>
                    </div>
                </div>

                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-[2rem] font-extrabold text-gray-900 tracking-tight leading-tight">Create Proposal</h1>
                        <p className="text-base text-gray-500 mt-1">Create a new proposal for your customer</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".docx"
                            className="hidden"
                            onChange={handleUploadTemplate}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={templateUploading}
                            className="bg-white border border-primary text-primary hover:bg-primary/5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <Upload size={16} />
                            {templateUploading ? 'Uploading...' : 'Upload Template'}
                        </button>
                        {templateInfo.hasTemplate && (
                            <span className="text-sm text-green-600 font-medium flex items-center gap-2">
                                <Check size={18} className="shrink-0" strokeWidth={2.5} />
                                Template Add successfully
                            </span>
                        )}
                        <button
                            className="bg-white border border-red-100 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <Trash2 size={16} />
                            Delete Inquiries
                        </button>
                    </div>
                </div>
                {templateError && (
                    <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                        {templateError}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Inquiries Reference Details */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <FileText size={20} className="text-primary" />
                                    <h3 className="text-base font-bold text-gray-900">Inquiries Reference Details</h3>
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowInquiryDropdown(!showInquiryDropdown)}
                                        className="bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} />
                                        Add Customer
                                    </button>

                                    {showInquiryDropdown && (
                                        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-96 max-h-64 overflow-y-auto">
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
                            </div>

                            <div className="space-y-4">

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                                    <input
                                        type="text"
                                        value={selectedInquiry?.customerName || ''}
                                        placeholder="Customer Id"
                                        disabled
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer Id</label>
                                    <input
                                        type="text"
                                        value={selectedInquiry?.customerId || ''}
                                        placeholder="Customer Id"
                                        disabled
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                    <textarea
                                        value={selectedInquiry?.projectDescription || ''}
                                        placeholder="Enter Project Description"
                                        disabled
                                        rows={3}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-400 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Required Features</label>
                                    <textarea
                                        value={selectedInquiry?.requiredFeatures.join(', ') || ''}
                                        placeholder="Enter Project Description"
                                        disabled
                                        rows={2}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-400 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* General Information */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Info size={20} className="text-primary" />
                                <h3 className="text-base font-bold text-gray-900">General Information</h3>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Title</label>
                                <input
                                    type="text"
                                    value={projectTitle}
                                    onChange={(e) => setProjectTitle(e.target.value)}
                                    placeholder="Enter Project Title"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Milestones */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Flag size={20} className="text-primary" />
                                <h3 className="text-base font-bold text-gray-900">Milestones</h3>
                            </div>

                            <div className="space-y-3">
                                {milestones.length > 0 && (
                                    <div className="grid grid-cols-3 gap-3 text-sm font-medium text-gray-700">
                                        <div>Title</div>
                                        <div>Amount</div>
                                        <div>Time</div>
                                    </div>
                                )}

                                {milestones.map((milestone, index) => (
                                    <div key={index} className="grid grid-cols-3 gap-3">
                                        <input
                                            type="text"
                                            value={milestone.title}
                                            onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                                            placeholder="Enter Project Title"
                                            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            value={milestone.amount}
                                            onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                                            placeholder="Optional"
                                            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="text"
                                            value={milestone.time}
                                            onChange={(e) => updateMilestone(index, 'time', e.target.value)}
                                            placeholder="Optional"
                                            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={addMilestone}
                                    className="text-primary hover:text-primary-hover font-medium text-sm flex items-center gap-1"
                                >
                                    <Plus size={16} />
                                    {milestones.length === 0 ? 'Add Milestone' : 'Add another Milestone'}
                                </button>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <DollarSign size={20} className="text-primary" />
                                <h3 className="text-base font-bold text-gray-900">Pricing</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Advance Payment</label>
                                    <input
                                        type="number"
                                        value={advancePayment}
                                        onChange={(e) => setAdvancePayment(e.target.value)}
                                        placeholder="Add advance payment"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Cost</label>
                                    <input
                                        type="number"
                                        value={projectCost}
                                        onChange={(e) => setProjectCost(e.target.value)}
                                        placeholder="Enter Project Cost"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="pt-4">
                                    <div className="text-sm font-medium text-gray-700 mb-2 text-center">Total Cost</div>
                                    <div className="bg-white border-2 border-primary rounded-lg px-6 py-6 text-center">
                                        <div className="text-3xl font-bold text-primary">
                                            LKR {calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting || !selectedInquiry}
                                        className="w-full px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Creating...' : 'Create Proposal'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
