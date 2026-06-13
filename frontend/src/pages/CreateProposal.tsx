import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Info, Flag, DollarSign, Trash2, Upload, Check } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import PriceBreakdownPanel from '../components/PriceBreakdownPanel';
import type { PriceBreakdown } from '../lib/campaignPricing';
import styles from './CreateProposal.module.css';

interface Inquiry {
    _id: string;
    customerId?: string;
    customerName: string;
    phoneNumber?: string;
    projectDescription: string;
    requiredFeatures: string[];
}

interface CustomerOption {
    _id: string;
    customerId: string;
    name: string;
    phoneNumber: string;
    inquiryId?: string;
    companyName?: string;
    productName?: string;
    productCode?: string;
}

type PickerEntry =
    | { kind: 'inquiry'; inquiry: Inquiry }
    | { kind: 'customer'; customer: CustomerOption };

interface Milestone {
    title: string;
    amount: string;
    time: string;
}

type PaymentPlan = 'FULL_PAYMENT' | 'THREE_MONTH' | 'SIX_MONTH';

export default function CreateProposal() {
    const navigate = useNavigate();
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [customersWithoutInquiry, setCustomersWithoutInquiry] = useState<CustomerOption[]>([]);
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
    const [linkingCustomer, setLinkingCustomer] = useState(false);
    const [searchInquiry, setSearchInquiry] = useState('');
    const [showInquiryDropdown, setShowInquiryDropdown] = useState(false);

    const [projectTitle, setProjectTitle] = useState('');
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>('FULL_PAYMENT');
    const [basePrice, setBasePrice] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [templateInfo, setTemplateInfo] = useState<{ hasTemplate: boolean; fileName?: string; isDefault?: boolean }>({ hasTemplate: false });
    const [templateUploading, setTemplateUploading] = useState(false);
    const [templateError, setTemplateError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    /** Blocks double POST before React re-renders `submitting` (avoids duplicate 500 toasts). */
    const submitLockRef = useRef(false);
    const [pricingPreview, setPricingPreview] = useState<{
        breakdown: PriceBreakdown | null;
        campaignName?: string;
        discountLabel?: string;
    } | null>(null);

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
                isDefault: res.data.isDefault,
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
            const [inqRes, custRes] = await Promise.all([
                api.get<Inquiry[]>('/inquiries'),
                api.get<CustomerOption[]>('/customers'),
            ]);
            if (inqRes.success && inqRes.data) {
                setInquiries(inqRes.data);

                const preSelectedId = location.state?.inquiryId as string | undefined;
                if (preSelectedId) {
                    const found = inqRes.data.find(i => i._id === preSelectedId);
                    if (found) {
                        handleSelectInquiry(found);
                    }
                } else {
                    const preSelectedCustomerId = location.state?.customerId as string | undefined;
                    if (preSelectedCustomerId && custRes.success && custRes.data) {
                        const cust = custRes.data.find((c) => c._id === preSelectedCustomerId);
                        if (cust) {
                            void handleSelectCustomer(cust);
                        }
                    }
                }
            }
            if (custRes.success && custRes.data) {
                const linkedInquiryIds = new Set(
                    custRes.data.map((c) => c.inquiryId).filter((id): id is string => Boolean(id))
                );
                const inquiryPhones = new Set(
                    (inqRes.data || []).map((i) => i.phoneNumber?.replace(/\D/g, '') || '')
                );
                const unlinked = custRes.data.filter(
                    (c) =>
                        !c.inquiryId &&
                        !linkedInquiryIds.has(c.inquiryId || '') &&
                        !inquiryPhones.has(c.phoneNumber?.replace(/\D/g, '') || '')
                );
                setCustomersWithoutInquiry(unlinked);
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

    const handleSelectCustomer = async (customer: CustomerOption) => {
        setLinkingCustomer(true);
        try {
            const res = await api.post<{ inquiryId: string; inquiry: Inquiry }>(
                `/customers/${customer._id}/ensure-inquiry`,
                {}
            );
            if (!res.success || !res.data?.inquiry) {
                pushSystemToast(res.error?.message || 'Could not link customer to inquiry', 'error');
                return;
            }
            const inquiry = res.data.inquiry;
            setInquiries((prev) => (prev.some((i) => i._id === inquiry._id) ? prev : [inquiry, ...prev]));
            setCustomersWithoutInquiry((prev) => prev.filter((c) => c._id !== customer._id));
            handleSelectInquiry(inquiry);
        } catch (err) {
            console.error(err);
            pushSystemToast('Could not link customer to inquiry', 'error');
        } finally {
            setLinkingCustomer(false);
        }
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
    const subtotalBeforeDiscount = paymentPlan === 'FULL_PAYMENT'
        ? parseAmount(basePrice)
        : parseAmount(basePrice) * 1.1;
    const finalTotal = pricingPreview?.breakdown?.finalPrice ?? subtotalBeforeDiscount;
    const calculatedAdvance = finalTotal * 0.4;
    const calculatedMonthly = installmentMonths > 0
        ? (finalTotal - calculatedAdvance) / installmentMonths
        : 0;

    useEffect(() => {
        if (!selectedInquiry || subtotalBeforeDiscount <= 0) {
            setPricingPreview(null);
            return;
        }
        let cancelled = false;
        api.get<{
            breakdown: PriceBreakdown | null;
            campaign: { name: string; discountType: string; discountValue: number } | null;
        }>(`/campaigns/preview?inquiryId=${selectedInquiry._id}&originalAmount=${subtotalBeforeDiscount}`)
            .then((res) => {
                if (cancelled || !res.success || !res.data) return;
                const label =
                    res.data.campaign?.discountType === 'flat'
                        ? `LKR ${Number(res.data.campaign.discountValue).toLocaleString()} OFF`
                        : `${res.data.campaign?.discountValue ?? 0}% OFF`;
                setPricingPreview({
                    breakdown: res.data.breakdown,
                    campaignName: res.data.campaign?.name,
                    discountLabel: res.data.breakdown ? label : undefined,
                });
            })
            .catch(() => {
                if (!cancelled) setPricingPreview(null);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedInquiry?._id, subtotalBeforeDiscount, paymentPlan, basePrice]);

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
                totalAmount: subtotalBeforeDiscount,
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

    const searchLower = searchInquiry.toLowerCase();
    const pickerEntries: PickerEntry[] = [
        ...inquiries.map((inquiry) => ({ kind: 'inquiry' as const, inquiry })),
        ...customersWithoutInquiry.map((customer) => ({ kind: 'customer' as const, customer })),
    ];
    const filteredPickerEntries = pickerEntries.filter((entry) => {
        if (entry.kind === 'inquiry') {
            const inq = entry.inquiry;
            return (
                inq.customerName.toLowerCase().includes(searchLower) ||
                (inq.customerId && inq.customerId.toLowerCase().includes(searchLower))
            );
        }
        const c = entry.customer;
        return (
            c.name.toLowerCase().includes(searchLower) ||
            c.customerId.toLowerCase().includes(searchLower) ||
            (c.companyName && c.companyName.toLowerCase().includes(searchLower))
        );
    });

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
                            {templateInfo.isDefault
                                ? 'Using Project proposal sample template'
                                : 'Template added successfully'}
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
                                            disabled={linkingCustomer}
                                        >
                                            <Plus size={16} />
                                            {linkingCustomer ? 'Linking...' : 'Select Customer'}
                                        </button>
                                        {showInquiryDropdown && (
                                            <div className={styles.dropdown}>
                                                <div className={styles.dropdownSearch}>
                                                    <input
                                                        type="text"
                                                        placeholder="Search inquiries or customers..."
                                                        value={searchInquiry}
                                                        onChange={(e) => setSearchInquiry(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className={styles.dropdownList}>
                                                    {filteredPickerEntries.length === 0 ? (
                                                        <div className={styles.dropdownItem} style={{ cursor: 'default', opacity: 0.7 }}>
                                                            No inquiries or customers found. Add a customer in the Customer tab or register an inquiry first.
                                                        </div>
                                                    ) : (
                                                        filteredPickerEntries.map((entry) =>
                                                            entry.kind === 'inquiry' ? (
                                                                <button
                                                                    key={`inq-${entry.inquiry._id}`}
                                                                    type="button"
                                                                    onClick={() => handleSelectInquiry(entry.inquiry)}
                                                                    className={styles.dropdownItem}
                                                                >
                                                                    <div className={styles.dropdownItemName}>{entry.inquiry.customerName}</div>
                                                                    {entry.inquiry.customerId && (
                                                                        <div className={styles.dropdownItemId}>{entry.inquiry.customerId}</div>
                                                                    )}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    key={`cust-${entry.customer._id}`}
                                                                    type="button"
                                                                    onClick={() => handleSelectCustomer(entry.customer)}
                                                                    className={styles.dropdownItem}
                                                                    disabled={linkingCustomer}
                                                                >
                                                                    <div className={styles.dropdownItemName}>
                                                                        {entry.customer.name}
                                                                        <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#6b7280' }}>
                                                                            (Customer tab)
                                                                        </span>
                                                                    </div>
                                                                    <div className={styles.dropdownItemId}>{entry.customer.customerId}</div>
                                                                </button>
                                                            )
                                                        )
                                                    )}
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
                                    <label>Subtotal before campaign</label>
                                    <input
                                        type="number"
                                        value={subtotalBeforeDiscount.toFixed(2)}
                                        readOnly
                                        className={styles.inputReadonly}
                                    />
                                </div>
                                {pricingPreview?.breakdown ? (
                                    <PriceBreakdownPanel
                                        originalPrice={pricingPreview.breakdown.originalPrice}
                                        discountAmount={pricingPreview.breakdown.discountAmount}
                                        finalPrice={pricingPreview.breakdown.finalPrice}
                                        campaignName={pricingPreview.campaignName}
                                        discountLabel={pricingPreview.discountLabel}
                                        compact
                                    />
                                ) : null}
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
                                    <div className={styles.totalCostLabel}>Final payable</div>
                                    <div className={styles.totalCostDisplay}>
                                        <div className={styles.totalCostAmount}>
                                            LKR {finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
