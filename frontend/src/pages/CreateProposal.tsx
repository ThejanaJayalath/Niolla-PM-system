import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Info, Flag, DollarSign, Trash2, Upload, Check } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import styles from './CreateProposal.module.css';

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

type PaymentPlan = 'FULL_PAYMENT' | 'THREE_MONTH' | 'SIX_MONTH';

export default function CreateProposal() {
    const navigate = useNavigate();
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
    const [searchInquiry, setSearchInquiry] = useState('');
    const [showInquiryDropdown, setShowInquiryDropdown] = useState(false);

    const [projectTitle, setProjectTitle] = useState('');
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>('FULL_PAYMENT');
    const [basePrice, setBasePrice] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [templateInfo, setTemplateInfo] = useState<{ hasTemplate: boolean; fileName?: string }>({ hasTemplate: false });
    const [templateUploading, setTemplateUploading] = useState(false);
    const [templateError, setTemplateError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    /** Blocks double POST before React re-renders `submitting` (avoids duplicate 500 toasts). */
    const submitLockRef = useRef(false);

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

    const parseAmount = (v: string) => {
        const n = parseFloat(v);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    const installmentMonths = paymentPlan === 'THREE_MONTH' ? 3 : paymentPlan === 'SIX_MONTH' ? 6 : 0;
    const calculatedTotal = paymentPlan === 'FULL_PAYMENT'
        ? parseAmount(basePrice)
        : parseAmount(basePrice) * 1.1;
    const calculatedAdvance = calculatedTotal * 0.4;
    const calculatedMonthly = installmentMonths > 0
        ? (calculatedTotal - calculatedAdvance) / installmentMonths
        : 0;

    const handleSubmit = async () => {
        if (submitLockRef.current || submitting) return;

        if (!selectedInquiry) {
            pushSystemToast('Please select an inquiry', 'warning');
            return;
        }

        if (!projectTitle.trim()) {
            pushSystemToast('Please enter a project title', 'warning');
            return;
        }
        const parsedBasePrice = parseAmount(basePrice);
        if (parsedBasePrice <= 0) {
            pushSystemToast('Please enter a valid base price', 'warning');
            return;
        }

        const mappedMilestones = milestones
            .filter(m => m.title.trim())
            .map(m => ({
                title: m.title.trim(),
                amount: m.amount ? parseFloat(m.amount) : undefined,
                timePeriod: m.time?.trim() || undefined
            }));

        submitLockRef.current = true;
        setSubmitting(true);
        try {
            const res = await api.post('/proposals', {
                inquiryId: selectedInquiry._id,
                projectName: projectTitle,
                milestones: mappedMilestones,
                paymentPlan,
                projectCost: parsedBasePrice,
                totalAmount: calculatedTotal,
                advancePayment: calculatedAdvance,
                installmentMonths: installmentMonths || undefined,
                monthlyInstallment: installmentMonths > 0 ? calculatedMonthly : undefined,
            });

            if (res.success) {
                navigate('/proposals');
            } else {
                pushSystemToast(res.error?.message || 'Failed to create proposal', 'error');
            }
        } catch (err) {
            console.error(err);
            pushSystemToast('Failed to create proposal', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredInquiries = inquiries.filter(inq =>
        inq.customerName.toLowerCase().includes(searchInquiry.toLowerCase()) ||
        (inq.customerId && inq.customerId.toLowerCase().includes(searchInquiry.toLowerCase()))
    );

    return (
        <div className={styles.container}>
            {/* Back & Breadcrumb - same as Proposal Details */}
            <div className="flex flex-col gap-4 mb-6">
                <Link to="/proposals" className={styles.backLink}>
                    <ArrowLeft size={20} />
                    <span>Back</span>
                </Link>
                <div className={styles.breadcrumb}>
                    <span>Home</span> &gt; <span>Proposals</span> &gt; <span className="font-semibold">Create Proposal</span>
                </div>
            </div>

            {/* Header - same structure as Proposal Details */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>Create Proposal</h1>
                    <p className={styles.subTitle}>Create a new proposal for your customer</p>
                </div>
                <div className={styles.headerActions}>
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
                        className={styles.uploadBtn}
                    >
                        <Upload size={16} />
                        {templateUploading ? 'Uploading...' : 'Upload Template'}
                    </button>
                    {templateInfo.hasTemplate && (
                        <span className={styles.templateSuccess}>
                            <Check size={18} strokeWidth={2.5} />
                            Template Add successfully
                        </span>
                    )}
                    <button type="button" className={styles.deleteBtn}>
                        <Trash2 size={16} />
                        Delete Inquiries
                    </button>
                </div>
            </div>

            {templateError && <div className={styles.templateError}>{templateError}</div>}

            <div className={styles.grid}>
                <div className={styles.mainCard}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>Proposal Details</h2>
                    </div>

                    <div className={styles.contentGrid}>
                        {/* Left Column */}
                        <div className={styles.leftColumn}>
                            {/* Inquiries Reference Details */}
                            <div className={styles.sectionCard}>
                                <div className={styles.sectionHeaderRow}>
                                    <div className={styles.sectionHeader}>
                                        <FileText size={18} />
                                        <h3>Inquiries Reference Details</h3>
                                    </div>
                                    <div className={styles.sectionHeaderActions}>
                                        <button
                                            type="button"
                                            onClick={() => setShowInquiryDropdown(!showInquiryDropdown)}
                                            className={styles.addCustomerBtn}
                                        >
                                            <Plus size={16} />
                                            Add Customer
                                        </button>
                                        {showInquiryDropdown && (
                                            <div className={styles.dropdown}>
                                                <div className={styles.dropdownSearch}>
                                                    <input
                                                        type="text"
                                                        placeholder="Search inquiries..."
                                                        value={searchInquiry}
                                                        onChange={(e) => setSearchInquiry(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className={styles.dropdownList}>
                                                    {filteredInquiries.map((inq) => (
                                                        <button
                                                            key={inq._id}
                                                            type="button"
                                                            onClick={() => handleSelectInquiry(inq)}
                                                            className={styles.dropdownItem}
                                                        >
                                                            <div className={styles.dropdownItemName}>{inq.customerName}</div>
                                                            {inq.customerId && <div className={styles.dropdownItemId}>{inq.customerId}</div>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        value={selectedInquiry?.customerName || ''}
                                        placeholder="Customer name"
                                        readOnly
                                        className={styles.inputReadonly}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Customer Id</label>
                                    <input
                                        type="text"
                                        value={selectedInquiry?.customerId || ''}
                                        placeholder="Customer Id"
                                        readOnly
                                        className={styles.inputReadonly}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Description</label>
                                    <textarea
                                        value={selectedInquiry?.projectDescription || ''}
                                        placeholder="Enter Project Description"
                                        readOnly
                                        rows={4}
                                        className={styles.inputReadonly}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Required Features</label>
                                    <textarea
                                        value={selectedInquiry?.requiredFeatures?.join(', ') || ''}
                                        placeholder="Required features"
                                        readOnly
                                        rows={2}
                                        className={styles.inputReadonly}
                                    />
                                </div>
                            </div>

                            {/* General Information */}
                            <div className={styles.sectionCard}>
                                <div className={styles.sectionHeader}>
                                    <Info size={18} />
                                    <h3>General Information</h3>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Project Title</label>
                                    <input
                                        type="text"
                                        value={projectTitle}
                                        onChange={(e) => setProjectTitle(e.target.value)}
                                        placeholder="Enter Project Title"
                                        className={styles.inputParam}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Milestones & Pricing */}
                        <div className={styles.rightColumn}>
                            {/* Milestones */}
                            <div className={styles.sectionCard}>
                                <div className={styles.sectionHeader}>
                                    <Flag size={18} />
                                    <h3>Milestones</h3>
                                </div>
                                <div className={styles.formGroup}>
                                    <table className={styles.milestonesTable}>
                                        <thead>
                                            <tr>
                                                <th>Title</th>
                                                <th>Amount</th>
                                                <th>Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {milestones.map((milestone, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={milestone.title}
                                                            onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                                                            placeholder="Milestone title"
                                                            className={styles.milestoneInput}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={milestone.amount}
                                                            onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                                                            placeholder="Optional"
                                                            className={styles.milestoneInput}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={milestone.time}
                                                            onChange={(e) => updateMilestone(index, 'time', e.target.value)}
                                                            placeholder="Optional"
                                                            className={styles.milestoneInput}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <button type="button" onClick={addMilestone} className={styles.addMilestoneBtn}>
                                        <Plus size={16} />
                                        {milestones.length === 0 ? 'Add Milestone' : 'Add another Milestone'}
                                    </button>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className={styles.sectionCard}>
                                <div className={styles.sectionHeader}>
                                    <DollarSign size={18} />
                                    <h3>Pricing</h3>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Payment Plan</label>
                                    <select
                                        value={paymentPlan}
                                        onChange={(e) => setPaymentPlan(e.target.value as PaymentPlan)}
                                        className={styles.inputParam}
                                    >
                                        <option value="FULL_PAYMENT">Full Payment</option>
                                        <option value="THREE_MONTH">3-Month Plan</option>
                                        <option value="SIX_MONTH">6-Month Plan</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Base Price</label>
                                    <input
                                        type="number"
                                        value={basePrice}
                                        onChange={(e) => setBasePrice(e.target.value)}
                                        placeholder="Enter base project price"
                                        className={styles.inputParam}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Total Price (Auto)</label>
                                    <input
                                        type="number"
                                        value={calculatedTotal.toFixed(2)}
                                        readOnly
                                        className={styles.inputReadonly}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Advance Amount (40%)</label>
                                    <input
                                        type="number"
                                        value={calculatedAdvance.toFixed(2)}
                                        readOnly
                                        className={styles.inputReadonly}
                                    />
                                </div>
                                {installmentMonths > 0 && (
                                    <div className={styles.formGroup}>
                                        <label>Monthly Installment ({installmentMonths} months)</label>
                                        <input
                                            type="number"
                                            value={calculatedMonthly.toFixed(2)}
                                            readOnly
                                            className={styles.inputReadonly}
                                        />
                                    </div>
                                )}
                                <div className={styles.totalCostContainer}>
                                    <div className={styles.totalCostLabel}>Total Cost</div>
                                    <div className={styles.totalCostDisplay}>
                                        <div className={styles.totalCostAmount}>
                                            LKR {calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting || !selectedInquiry}
                                    className={styles.submitBtn}
                                >
                                    {submitting ? 'Creating...' : 'Create Proposal'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
