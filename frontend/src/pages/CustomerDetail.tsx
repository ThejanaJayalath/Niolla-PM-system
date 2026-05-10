import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    ChevronRight,
    Edit3,
    Trash2,
    FolderKanban,
    Pencil,
} from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { SOFTWARE_PRODUCT_OPTIONS } from '../constants/customerServiceProducts';
import { normalizeProjectStatus, PROJECT_LIFECYCLE_LABELS } from '../types/projectLifecycle';
import styles from './CustomerDetail.module.css';

interface Customer {
    _id: string;
    customerId: string;
    name: string;
    phoneNumber: string;
    email?: string;
    projects: string[];
    address?: string;
    businessType?: string;
    companyName?: string;
    nicNumber?: string;
    status?: 'active' | 'inactive';
    serviceCategories?: string[];
}

interface Project {
    _id: string;
    projectName: string;
    totalValue: number;
    status: string;
}

interface Invoice {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    status: string;
    projectName?: string;
}

interface CallMeta {
    direction?: 'INBOUND' | 'OUTBOUND';
    durationSec?: number;
    outcome?: 'ANSWERED' | 'NO_ANSWER' | 'VOICEMAIL' | 'FOLLOW_UP_REQUIRED' | 'CLOSED';
    nextFollowUpAt?: string;
}

interface Interaction {
    _id: string;
    type: 'CALL' | 'MEETING' | 'NOTE' | 'STATUS_CHANGE' | 'REQUIREMENT_UPDATE';
    summary: string;
    details?: string;
    occurredAt: string;
    callMeta?: CallMeta;
}

interface CustomerRequirement {
    _id: string;
    title: string;
    description?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DEFERRED';
    source: 'INQUIRY' | 'CALL' | 'MEETING' | 'MANUAL' | 'CUSTOMER' | 'CUSTOMER_PORTAL';
    projectRef?: string;
    assignedEmployeeIds?: string[];
    requirementPayoutValue?: number;
    capturedAt: string;
}

type CallDurationUnit = 'seconds' | 'minutes' | 'hours';

function parseCallDurationToSeconds(amountStr: string, unit: CallDurationUnit): number | undefined {
    const trimmed = amountStr.trim();
    if (!trimmed) return undefined;
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 0) return undefined;
    if (unit === 'seconds') return n;
    if (unit === 'minutes') return n * 60;
    return n * 3600;
}

function formatCallDurationSeconds(sec: number | undefined): string {
    if (sec === undefined || sec === null || !Number.isFinite(sec) || sec < 0) return '-';
    if (sec === 0) return '0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts: string[] = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
}

function secondsToAmountAndUnit(sec: number | undefined): { amount: string; unit: CallDurationUnit } {
    if (sec === undefined || sec === null || !Number.isFinite(sec) || sec < 0) return { amount: '', unit: 'minutes' };
    if (sec >= 3600 && sec % 3600 === 0) return { amount: String(sec / 3600), unit: 'hours' };
    if (sec >= 60 && sec % 60 === 0) return { amount: String(sec / 60), unit: 'minutes' };
    return { amount: String(sec), unit: 'seconds' };
}

/** Normalize populated or raw Mongo id on API models. */
function entityId(ref: unknown): string {
    if (!ref) return '';
    if (typeof ref === 'string') return ref;
    if (typeof ref === 'object' && ref !== null && '_id' in ref) {
        const id = (ref as { _id: { toString: () => string } })._id;
        return id && typeof id.toString === 'function' ? id.toString() : '';
    }
    return '';
}

/** Contract face value from plan (down + all installment slots). */
function planFaceValue(plan: { downPaymentAmt?: number; installmentAmt?: number; totalInstallments?: number }): number {
    return (
        Number(plan.downPaymentAmt || 0) + Number(plan.installmentAmt || 0) * Number(plan.totalInstallments || 0)
    );
}

function installmentProjectId(inst: { projectId?: string; planId?: unknown }, plans: { _id?: string; projectId?: unknown }[]): string {
    if (inst?.projectId) return String(inst.projectId);
    const rawPlan = inst?.planId;
    const planIdStr = typeof rawPlan === 'string' ? rawPlan : entityId(rawPlan);
    if (!planIdStr) return '';
    const plan = plans.find((p) => String(p._id) === planIdStr);
    return plan ? entityId(plan.projectId) : '';
}

export default function CustomerDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [overdueInstallments, setOverdueInstallments] = useState<any[]>([]);
    const [pendingInstallments, setPendingInstallments] = useState<any[]>([]);
    /** All installments for this customer (folder tab drill-down). */
    const [allInstallments, setAllInstallments] = useState<any[]>([]);
    /** Selected project inside "Projects & payments" explorer. */
    const [cashflowProjectId, setCashflowProjectId] = useState<string | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [callLogs, setCallLogs] = useState<Interaction[]>([]);
    const [requirements, setRequirements] = useState<CustomerRequirement[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<
        'details' | 'projects' | 'cashflow' | 'payments' | 'history' | 'calls' | 'requirements'
    >('details');
    // Collapsible states for payments
    const [expandedPaymentSection, setExpandedPaymentSection] = useState<
        'plans' | 'history' | 'overdue' | 'invoices' | 'installments_pending'
    >('plans');
    const [newCall, setNewCall] = useState({
        summary: '',
        details: '',
        direction: 'OUTBOUND' as 'INBOUND' | 'OUTBOUND',
        durationAmount: '',
        durationUnit: 'minutes' as CallDurationUnit,
        outcome: 'ANSWERED' as 'ANSWERED' | 'NO_ANSWER' | 'VOICEMAIL' | 'FOLLOW_UP_REQUIRED' | 'CLOSED',
    });
    const [newRequirement, setNewRequirement] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        status: 'OPEN' as 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DEFERRED',
        source: 'MANUAL' as CustomerRequirement['source'],
        projectRef: '' as string,
        requirementPayoutValue: '' as string,
    });

    const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null);
    const [editRequirementForm, setEditRequirementForm] = useState<{
        title: string;
        description: string;
        priority: CustomerRequirement['priority'];
        status: CustomerRequirement['status'];
        source: CustomerRequirement['source'];
    }>({
        title: '',
        description: '',
        priority: 'MEDIUM',
        status: 'OPEN',
        source: 'MANUAL',
    });
    const [deleteRequirementId, setDeleteRequirementId] = useState<string | null>(null);
    const [deletingRequirement, setDeletingRequirement] = useState(false);

    const [editingCallLogId, setEditingCallLogId] = useState<string | null>(null);
    const [editCallForm, setEditCallForm] = useState({
        summary: '',
        details: '',
        direction: 'OUTBOUND' as 'INBOUND' | 'OUTBOUND',
        durationAmount: '',
        durationUnit: 'minutes' as CallDurationUnit,
        outcome: 'ANSWERED' as 'ANSWERED' | 'NO_ANSWER' | 'VOICEMAIL' | 'FOLLOW_UP_REQUIRED' | 'CLOSED',
    });
    const [deleteCallLogId, setDeleteCallLogId] = useState<string | null>(null);
    const [deletingCallLog, setDeletingCallLog] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Customer>>({});

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    /** Projects, payment plans, installments, invoices, and payments for this customer (Mongo `clientId` = this profile). */
    const fetchCustomerFinancialSnapshot = useCallback(async () => {
        if (!id) return;
        try {
            const [projRes, invRes, plansRes, txRes, overdueRes, pendingInstRes] = await Promise.all([
                api.get<Project[]>(`/projects?clientId=${id}`),
                api.get<Invoice[]>(`/invoices?clientId=${id}`),
                api.get<any[]>(`/payment-plans?clientId=${id}`),
                api.get<any[]>(`/payments?clientId=${id}`),
                api.get<any[]>(`/installments?clientId=${id}&status=overdue`),
                api.get<any[]>(`/installments?clientId=${id}&status=pending`),
            ]);
            setProjects(projRes.success && projRes.data ? projRes.data : []);
            setInvoices(invRes.success && invRes.data ? invRes.data : []);
            setPaymentPlans(plansRes.success && plansRes.data ? plansRes.data : []);
            setTransactions(txRes.success && txRes.data ? txRes.data : []);
            setOverdueInstallments(overdueRes.success && overdueRes.data ? overdueRes.data : []);
            setPendingInstallments(pendingInstRes.success && pendingInstRes.data ? pendingInstRes.data : []);
        } catch (err) {
            console.error(err);
        }
    }, [id]);

    const load = async () => {
        if (!id) return;
        try {
            const custRes = await api.get<Customer>(`/customers/${id}`);
            if (custRes.success && custRes.data) {
                setCustomer(custRes.data);
                setEditForm(custRes.data);
            }
            await fetchCustomerFinancialSnapshot();
            const interactionRes = await api.get<Interaction[]>(`/customers/${id}/interactions`);
            if (interactionRes.success && interactionRes.data) setInteractions(interactionRes.data);
            const callsRes = await api.get<Interaction[]>(`/customers/${id}/call-logs`);
            if (callsRes.success && callsRes.data) setCallLogs(callsRes.data);
            const requirementsRes = await api.get<CustomerRequirement[]>(`/customers/${id}/requirements`);
            if (requirementsRes.success && requirementsRes.data) setRequirements(requirementsRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, [id]);

    /** Sidebar flow: /projects-payments → customer → /customer/:id?view=projects-payments */
    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'projects-payments') {
            setActiveTab('cashflow');
        }
    }, [searchParams, id]);

    /** Refresh billing when opening this tab so new projects / plans / payments appear without a full page reload. */
    useEffect(() => {
        if (!id || activeTab !== 'payments') return;
        void fetchCustomerFinancialSnapshot();
    }, [id, activeTab, fetchCustomerFinancialSnapshot]);

    useEffect(() => {
        if (activeTab !== 'cashflow') {
            setCashflowProjectId(null);
            return;
        }
        if (!id) return;
        void (async () => {
            await fetchCustomerFinancialSnapshot();
            try {
                const instRes = await api.get<any[]>(`/installments?clientId=${id}`);
                setAllInstallments(instRes.success && instRes.data ? instRes.data : []);
            } catch {
                setAllInstallments([]);
            }
        })();
    }, [id, activeTab, fetchCustomerFinancialSnapshot]);

    const handleSave = async () => {
        if (!id) return;
        try {
            const res = await api.patch<Customer>(`/customers/${id}`, editForm);
            if (res.success && res.data) {
                setCustomer(res.data);
                setIsEditing(false);
            }
        } catch (err) {
            console.error('Failed to save', err);
            alert('Failed to save customer details');
        }
    };

    const confirmDelete = async () => {
        if (!id) return;
        setDeleting(true);
        try {
            await api.delete(`/customers/${id}`);
            navigate('/customer');
        } catch (err) {
            console.error('Failed to delete', err);
            alert('Failed to delete customer');
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const addCallLog = async () => {
        if (!id) return;
        const summaryTrim = newCall.summary.trim();
        const detailsTrim = newCall.details.trim();
        const firstLine = detailsTrim.split(/\r?\n/).find((l) => l.trim())?.trim() || '';
        const summary = summaryTrim || firstLine || detailsTrim.slice(0, 160);
        if (!summary) {
            alert('Enter a short call summary or call notes so the log can be saved.');
            return;
        }
        const durationSec = parseCallDurationToSeconds(newCall.durationAmount, newCall.durationUnit);
        const res = await api.post<Interaction>(`/customers/${id}/call-logs`, {
            summary,
            details: detailsTrim || undefined,
            callMeta: {
                direction: newCall.direction,
                ...(durationSec !== undefined ? { durationSec } : {}),
                outcome: newCall.outcome,
            },
        });
        if (res.success) {
            setNewCall({
                summary: '',
                details: '',
                direction: 'OUTBOUND',
                durationAmount: '',
                durationUnit: 'minutes',
                outcome: 'ANSWERED',
            });
            await load();
        } else {
            alert(res.error?.message || 'Could not save call log. Use a whole number for duration (or leave duration blank).');
        }
    };

    const addRequirement = async () => {
        if (!id || !newRequirement.title.trim()) return;
        const payload = {
            title: newRequirement.title.trim(),
            description: newRequirement.description.trim() || undefined,
            priority: newRequirement.priority,
            status: newRequirement.status,
            source: newRequirement.source,
            projectRef: newRequirement.projectRef.trim() || undefined,
        };
        const res = await api.post<CustomerRequirement>(`/customers/${id}/requirements`, payload);
        if (res.success) {
            setNewRequirement({
                title: '',
                description: '',
                priority: 'MEDIUM',
                status: 'OPEN',
                source: 'MANUAL',
                projectRef: '',
                requirementPayoutValue: '',
            });
            await load();
        }
    };

    const startEditRequirement = (reqItem: CustomerRequirement) => {
        setEditingRequirementId(reqItem._id);
        setEditRequirementForm({
            title: reqItem.title,
            description: reqItem.description || '',
            priority: reqItem.priority,
            status: reqItem.status,
            source: reqItem.source,
        });
    };

    const cancelEditRequirement = () => {
        setEditingRequirementId(null);
    };

    const saveEditRequirement = async () => {
        if (!editingRequirementId || !editRequirementForm.title.trim()) return;
        const res = await api.patch<CustomerRequirement>(`/requirements/${editingRequirementId}`, {
            title: editRequirementForm.title.trim(),
            description: editRequirementForm.description.trim() || undefined,
            priority: editRequirementForm.priority,
            status: editRequirementForm.status,
            source: editRequirementForm.source,
        });
        if (res.success) {
            setEditingRequirementId(null);
            await load();
        } else {
            alert(res.error?.message || 'Failed to update requirement');
        }
    };

    const confirmDeleteRequirement = async () => {
        if (!id || !deleteRequirementId) return;
        setDeletingRequirement(true);
        const res = await api.delete(`/customers/${id}/requirements/${deleteRequirementId}`);
        setDeletingRequirement(false);
        setDeleteRequirementId(null);
        if (res.success !== false) {
            if (editingRequirementId === deleteRequirementId) setEditingRequirementId(null);
            await load();
        } else {
            alert(res.error?.message || 'Failed to delete requirement');
        }
    };

    const startEditCallLog = (log: Interaction) => {
        const { amount, unit } = secondsToAmountAndUnit(log.callMeta?.durationSec);
        setEditingCallLogId(log._id);
        setEditCallForm({
            summary: log.summary,
            details: log.details || '',
            direction: (log.callMeta?.direction as 'INBOUND' | 'OUTBOUND') || 'OUTBOUND',
            durationAmount: amount,
            durationUnit: unit,
            outcome: (log.callMeta?.outcome as typeof editCallForm.outcome) || 'ANSWERED',
        });
    };

    const cancelEditCallLog = () => {
        setEditingCallLogId(null);
    };

    const saveEditCallLog = async () => {
        if (!id || !editingCallLogId) return;
        const summaryTrim = editCallForm.summary.trim();
        const detailsTrim = editCallForm.details.trim();
        const firstLine = detailsTrim.split(/\r?\n/).find((l) => l.trim())?.trim() || '';
        const summary = summaryTrim || firstLine || detailsTrim.slice(0, 160);
        if (!summary) {
            alert('Enter a short call summary or call notes so the log can be saved.');
            return;
        }
        const durationSec = parseCallDurationToSeconds(editCallForm.durationAmount, editCallForm.durationUnit);
        const res = await api.patch<Interaction>(`/customers/${id}/call-logs/${editingCallLogId}`, {
            summary,
            details: detailsTrim || undefined,
            callMeta: {
                direction: editCallForm.direction,
                outcome: editCallForm.outcome,
                ...(durationSec !== undefined ? { durationSec } : {}),
            },
        });
        if (res.success) {
            setEditingCallLogId(null);
            await load();
        } else {
            alert(res.error?.message || 'Could not update call log. Use a whole number for duration (or leave duration blank).');
        }
    };

    const confirmDeleteCallLog = async () => {
        if (!id || !deleteCallLogId) return;
        setDeletingCallLog(true);
        const res = await api.delete(`/customers/${id}/call-logs/${deleteCallLogId}`);
        setDeletingCallLog(false);
        setDeleteCallLogId(null);
        if (res.success !== false) {
            if (editingCallLogId === deleteCallLogId) setEditingCallLogId(null);
            await load();
        } else {
            alert(res.error?.message || 'Failed to delete call log');
        }
    };

    const toggleServiceCategory = (value: string) => {
        setEditForm((prev) => {
            const cur = prev.serviceCategories ?? customer?.serviceCategories ?? [];
            const set = new Set(cur);
            if (set.has(value)) set.delete(value);
            else set.add(value);
            return { ...prev, serviceCategories: [...set] };
        });
    };

    const productLabel = (value: string) =>
        SOFTWARE_PRODUCT_OPTIONS.find((o) => o.value === value)?.label ?? value;

    if (loading) return <div className={styles.container}>Loading...</div>;
    if (!customer) return <div className={styles.container}>Customer not found.</div>;

    const mainCustomerPlans = paymentPlans.filter((p) => (p.planKind ?? 'primary') === 'primary');
    const addonCustomerPlans = paymentPlans.filter((p) => p.planKind === 'addon');

    const summaryMainScheduled = mainCustomerPlans.reduce((s, p) => s + planFaceValue(p), 0);
    const summaryAddonScheduled = addonCustomerPlans.reduce((s, p) => s + planFaceValue(p), 0);
    const installmentPaidByKind = (kind: 'primary' | 'addon') =>
        allInstallments
            .filter((i) => (kind === 'addon' ? i.planKind === 'addon' : (i.planKind ?? 'primary') !== 'addon'))
            .reduce((s, i) => s + Number(i.paidAmount || 0), 0);
    const summaryMainPaidInstallments = installmentPaidByKind('primary');
    const summaryAddonPaidInstallments = installmentPaidByKind('addon');
    const selectedCashflowProject = cashflowProjectId ? projects.find((p) => p._id === cashflowProjectId) : undefined;

    return (
        <div className={styles.container}>
            <div className="flex flex-col gap-4 mb-6">
                <Link to="/customer" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors w-fit">
                    <ArrowLeft size={20} />
                    <span className="font-medium text-lg">Back</span>
                </Link>
                <div className={styles.breadcrumb}>
                    <span>Home</span> &gt; <span>Customer</span> &gt; <span className="font-semibold">Customer Details</span>
                </div>
            </div>

            <div className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>{customer.name}</h1>
                    <p className={styles.subTitle}>{customer.customerId} • {customer.companyName || 'No Company'}</p>
                    <div className={styles.productChipRow} aria-label="Linked software products">
                        {(customer.serviceCategories && customer.serviceCategories.length > 0) ? (
                            customer.serviceCategories.map((cat) => (
                                <span key={cat} className={styles.productChip}>{productLabel(cat)}</span>
                            ))
                        ) : (
                            <span className={styles.productChipMuted}>No software products linked</span>
                        )}
                    </div>
                </div>
                <button onClick={() => setShowDeleteModal(true)} className={styles.deleteBtn}>
                    <Trash2 size={16} /> Delete Customer
                </button>
            </div>

            <div className={`${styles.grid} mt-4`}>
                {/* Main Content: Tabs and Details */}
                <div className="col-span-1 md:col-span-3">
                    
                    {/* Tabs Navbar */}
                    <div className="flex border-b border-gray-200 mb-6 pb-0">
                        <button 
                            onClick={() => setActiveTab('details')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'details' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            General Details
                        </button>
                        <button 
                            onClick={() => setActiveTab('projects')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'projects' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Projects ({projects.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('cashflow')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'cashflow' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Projects & payments
                        </button>
                        <button 
                            onClick={() => setActiveTab('payments')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'payments' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Payments & Billing
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'history' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Interaction History
                        </button>
                        <button 
                            onClick={() => setActiveTab('calls')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'calls' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Call Logs ({callLogs.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('requirements')}
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'requirements' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Software Requirements ({requirements.length})
                        </button>
                    </div>

                    {activeTab === 'details' && (
                        <div className={styles.mainCard}>
                            <div className={styles.cardHeader}>
                                <h2 className={styles.cardTitle}>Customer Details</h2>
                                <div className="flex items-center gap-2">
                                    {isEditing ? (
                                        <button onClick={handleSave} className={styles.saveBtn}>Save Customer</button>
                                    ) : (
                                        <button onClick={() => { setEditForm({ ...customer }); setIsEditing(true); }} className={styles.editBtn}>
                                            <Edit3 size={16} /> Edit Details
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Name</label>
                                <input
                                    value={isEditing ? editForm.name : customer.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Phone Number</label>
                                <input
                                    value={isEditing ? editForm.phoneNumber : customer.phoneNumber}
                                    onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Email</label>
                                <input
                                    value={isEditing ? editForm.email || '' : customer.email || ''}
                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Company Name</label>
                                <input
                                    value={isEditing ? editForm.companyName || '' : customer.companyName || ''}
                                    onChange={e => setEditForm({ ...editForm, companyName: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Address</label>
                                <textarea
                                    value={isEditing ? editForm.address || '' : customer.address || ''}
                                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                    rows={3}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>NIC Number</label>
                                <input
                                    value={isEditing ? editForm.nicNumber || '' : customer.nicNumber || ''}
                                    onChange={e => setEditForm({ ...editForm, nicNumber: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Software products</label>
                                {isEditing ? (
                                    <div className={styles.productChipRow}>
                                        {SOFTWARE_PRODUCT_OPTIONS.map(({ value, label }) => {
                                            const selected = (editForm.serviceCategories ?? customer.serviceCategories ?? []).includes(value);
                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    className={`${styles.productChipBtn} ${selected ? styles.productChipBtnActive : ''}`}
                                                    onClick={() => toggleServiceCategory(value)}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className={styles.productChipRow}>
                                        {(customer.serviceCategories && customer.serviceCategories.length > 0) ? (
                                            customer.serviceCategories.map((v) => (
                                                <span key={v} className={styles.productChip}>{productLabel(v)}</span>
                                            ))
                                        ) : (
                                            <span className={styles.productChipMuted}>None — click Edit to link POS, ERP, website, mobile app, etc.</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'projects' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
                            <div className="flex justify-between flex-wrap gap-4 items-center mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">Linked projects</h2>
                                    <p className="text-sm text-gray-500 mt-1 max-w-xl">
                                        Each project is tied to this customer. Open a project for the main contract payment plan, installments, and any
                                        separate value-added requirement billing.
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate(`/projects?newProjectForCustomer=${customer._id}`)}
                                    className={styles.orangeBtn}
                                >
                                    Start New Project
                                </button>
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                {projects.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <div className="bg-orange-100 p-3 rounded-full mb-3">
                                            <FolderKanban size={24} className="text-orange-500" />
                                        </div>
                                        <p className="text-gray-500 font-medium text-sm">No Projects Linked</p>
                                    </div>
                                ) : (
                                    projects.map(p => (
                                        <div key={p._id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow cursor-pointer bg-gray-50 hover:bg-white" onClick={() => navigate(`/projects/${p._id}`)}>
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">
                                                    <FolderKanban size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{p.projectName}</div>
                                                    <div className="text-sm text-gray-500">Total Value: Rs. {Number(p.totalValue || 0).toLocaleString()}</div>
                                                </div>
                                            </div>
                                            <span
                                                className={`px-3 py-1 text-xs rounded-full font-semibold tracking-wide ${
                                                    normalizeProjectStatus(p.status) === 'under_development'
                                                        ? 'bg-green-100 text-green-700'
                                                        : normalizeProjectStatus(p.status) === 'completed'
                                                          ? 'bg-blue-100 text-blue-800'
                                                          : normalizeProjectStatus(p.status) === 'unassigned'
                                                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                                            : 'bg-gray-200 text-gray-700'
                                                }`}
                                            >
                                                {PROJECT_LIFECYCLE_LABELS[normalizeProjectStatus(p.status)]}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'cashflow' && (
                        <div className="flex flex-col gap-4">
                            <p className="text-sm text-gray-600 px-1">
                                Browse this customer like a folder: pick a project to see main contract vs value-added
                                amounts, installments, and paid transactions for that project only.
                            </p>

                            {!cashflowProjectId ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                            <div className="text-xs font-semibold text-gray-500 uppercase">Main contract (planned)</div>
                                            <div className="text-lg font-bold text-gray-900 mt-1">
                                                Rs. {summaryMainScheduled.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
                                            <div className="text-xs font-semibold text-amber-900 uppercase">Value-added (planned)</div>
                                            <div className="text-lg font-bold text-amber-950 mt-1">
                                                Rs. {summaryAddonScheduled.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                            <div className="text-xs font-semibold text-gray-500 uppercase">Collected (main)</div>
                                            <div className="text-lg font-bold text-emerald-800 mt-1">
                                                Rs. {summaryMainPaidInstallments.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">From installment paid balances</div>
                                        </div>
                                        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                                            <div className="text-xs font-semibold text-gray-500 uppercase">Collected (add-ons)</div>
                                            <div className="text-lg font-bold text-emerald-800 mt-1">
                                                Rs. {summaryAddonPaidInstallments.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
                                        <h2 className="text-lg font-bold text-gray-800 mb-1">Projects</h2>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Each row is one linked project. Open it to see payment plans, installments, and
                                            receipts for that project only.
                                        </p>
                                        {projects.length === 0 ? (
                                            <p className="text-gray-500 text-sm">No projects linked to this customer yet.</p>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                {projects.map((proj) => {
                                                    const pid = proj._id;
                                                    const plansHere = paymentPlans.filter((p) => entityId(p.projectId) === pid);
                                                    const mainPlans = plansHere.filter(
                                                        (p) => (p.planKind ?? 'primary') === 'primary'
                                                    );
                                                    const addonPlans = plansHere.filter((p) => p.planKind === 'addon');
                                                    const instForProj = allInstallments.filter(
                                                        (i) => installmentProjectId(i, paymentPlans) === pid
                                                    );
                                                    const mainInst = instForProj.filter(
                                                        (i) => (i.planKind ?? 'primary') !== 'addon'
                                                    );
                                                    const addonInst = instForProj.filter((i) => i.planKind === 'addon');
                                                    const mainSched = mainPlans.reduce((s, pl) => s + planFaceValue(pl), 0);
                                                    const addonSched = addonPlans.reduce((s, pl) => s + planFaceValue(pl), 0);
                                                    const mainPaid = mainInst.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
                                                    const addonPaid = addonInst.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
                                                    return (
                                                        <button
                                                            key={pid}
                                                            type="button"
                                                            onClick={() => setCashflowProjectId(pid)}
                                                            className="flex w-full text-left items-stretch justify-between gap-4 p-4 border border-gray-100 rounded-xl hover:border-orange-200 hover:shadow-md transition-all bg-gray-50 hover:bg-white"
                                                        >
                                                            <div className="flex items-start gap-3 min-w-0">
                                                                <div className="h-10 w-10 shrink-0 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                                                                    <FolderKanban size={18} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-semibold text-gray-900 truncate">
                                                                        {proj.projectName}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                                        Project total (contract) Rs.{' '}
                                                                        {Number(proj.totalValue || 0).toLocaleString()}
                                                                    </div>
                                                                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                                                                        <span>
                                                                            Main plan Rs. {mainSched.toLocaleString()}
                                                                        </span>
                                                                        <span>
                                                                            Main paid Rs. {mainPaid.toLocaleString()}
                                                                        </span>
                                                                        <span className="text-amber-800">
                                                                            Add-on Rs. {addonSched.toLocaleString()}
                                                                        </span>
                                                                        <span className="text-amber-800">
                                                                            Add-on paid Rs. {addonPaid.toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end justify-center shrink-0 gap-1">
                                                                <ChevronRight className="text-gray-400" size={22} />
                                                                <span className="text-xs font-medium text-orange-600">
                                                                    Details
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : selectedCashflowProject ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setCashflowProjectId(null)}
                                            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                                        >
                                            <ArrowLeft size={18} />
                                            All projects
                                        </button>
                                        <span className="text-gray-300">/</span>
                                        <span className="text-sm font-semibold text-gray-800 truncate max-w-[min(100%,280px)]">
                                            {selectedCashflowProject.projectName}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/projects/${cashflowProjectId}`)}
                                            className={`${styles.orangeBtn} ml-auto`}
                                            style={{ width: 'auto' }}
                                        >
                                            Open project
                                        </button>
                                    </div>

                                    {(() => {
                                        const pid = cashflowProjectId!;
                                        const plansHere = paymentPlans.filter((p) => entityId(p.projectId) === pid);
                                        const mainPlans = plansHere.filter(
                                            (p) => (p.planKind ?? 'primary') === 'primary'
                                        );
                                        const addonPlans = plansHere.filter((p) => p.planKind === 'addon');
                                        const instForProj = allInstallments.filter(
                                            (i) => installmentProjectId(i, paymentPlans) === pid
                                        );
                                        const txsHere = transactions.filter(
                                            (t: { projectId?: string }) => t.projectId === pid
                                        );
                                        const invHere = invoices.filter(
                                            (inv) =>
                                                inv.projectName &&
                                                inv.projectName === selectedCashflowProject.projectName
                                        );
                                        const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString()}`;
                                        return (
                                            <>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                                                        <div className="text-xs font-bold text-gray-600 uppercase mb-2">
                                                            Main contract
                                                        </div>
                                                        <div className="text-sm text-gray-700 space-y-1">
                                                            <div>
                                                                Planned:{' '}
                                                                {fmt(
                                                                    mainPlans.reduce((s, pl) => s + planFaceValue(pl), 0)
                                                                )}
                                                            </div>
                                                            <div>
                                                                Paid on installments:{' '}
                                                                {fmt(
                                                                    instForProj
                                                                        .filter(
                                                                            (i) =>
                                                                                (i.planKind ?? 'primary') !== 'addon'
                                                                        )
                                                                        .reduce((s, i) => s + Number(i.paidAmount || 0), 0)
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                                                        <div className="text-xs font-bold text-amber-900 uppercase mb-2">
                                                            Value-added (requirements)
                                                        </div>
                                                        <div className="text-sm text-gray-800 space-y-1">
                                                            <div>
                                                                Planned:{' '}
                                                                {fmt(
                                                                    addonPlans.reduce(
                                                                        (s, pl) => s + planFaceValue(pl),
                                                                        0
                                                                    )
                                                                )}
                                                            </div>
                                                            <div>
                                                                Paid on installments:{' '}
                                                                {fmt(
                                                                    instForProj
                                                                        .filter((i) => i.planKind === 'addon')
                                                                        .reduce(
                                                                            (s, i) => s + Number(i.paidAmount || 0),
                                                                            0
                                                                        )
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
                                                    <h3 className="font-bold text-gray-800 mb-3">Payment plans</h3>
                                                    {plansHere.length === 0 ? (
                                                        <p className="text-sm text-gray-500">No plans for this project.</p>
                                                    ) : (
                                                        <ul className="space-y-2 text-sm">
                                                            {plansHere.map((pl: (typeof paymentPlans)[number]) => (
                                                                <li
                                                                    key={pl._id}
                                                                    className="flex justify-between border border-gray-100 rounded-lg px-3 py-2"
                                                                >
                                                                    <span>
                                                                        {(pl.planKind ?? 'primary') === 'addon'
                                                                            ? 'Add-on'
                                                                            : 'Main'}{' '}
                                                                        #{String(pl._id).slice(-6)}
                                                                    </span>
                                                                    <span className="text-gray-600">
                                                                        {fmt(planFaceValue(pl))}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>

                                                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 overflow-x-auto">
                                                    <h3 className="font-bold text-gray-800 mb-3">Installments</h3>
                                                    {instForProj.length === 0 ? (
                                                        <p className="text-sm text-gray-500">No installments yet.</p>
                                                    ) : (
                                                        <table className="w-full text-left text-sm min-w-[480px]">
                                                            <thead>
                                                                <tr className="border-b border-gray-200 text-gray-600">
                                                                    <th className="pb-2 font-medium">#</th>
                                                                    <th className="pb-2 font-medium">Type</th>
                                                                    <th className="pb-2 font-medium">Due</th>
                                                                    <th className="pb-2 font-medium text-right">Due amt</th>
                                                                    <th className="pb-2 font-medium text-right">Paid</th>
                                                                    <th className="pb-2 font-medium">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {instForProj
                                                                    .slice()
                                                                    .sort(
                                                                        (a, b) =>
                                                                            Number(a.installmentNo || 0) -
                                                                            Number(b.installmentNo || 0)
                                                                    )
                                                                    .map((row: { _id: string; installmentNo?: number; planKind?: string; dueDate?: string; dueAmount?: number; paidAmount?: number; status?: string }) => (
                                                                        <tr key={row._id} className="border-b border-gray-50">
                                                                            <td className="py-2">{row.installmentNo}</td>
                                                                            <td className="py-2">
                                                                                {row.planKind === 'addon' ? 'Add-on' : 'Main'}
                                                                            </td>
                                                                            <td className="py-2 text-gray-600">
                                                                                {row.dueDate
                                                                                    ? new Date(row.dueDate).toLocaleDateString()
                                                                                    : '—'}
                                                                            </td>
                                                                            <td className="py-2 text-right">
                                                                                {fmt(Number(row.dueAmount))}
                                                                            </td>
                                                                            <td className="py-2 text-right text-emerald-800">
                                                                                {fmt(Number(row.paidAmount))}
                                                                            </td>
                                                                            <td className="py-2 capitalize">{row.status}</td>
                                                                        </tr>
                                                                    ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>

                                                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 overflow-x-auto">
                                                    <h3 className="font-bold text-gray-800 mb-3">Paid transactions</h3>
                                                    {txsHere.length === 0 ? (
                                                        <p className="text-sm text-gray-500">
                                                            No payment transactions recorded for this project yet (records
                                                            appear when staff posts a payment against an installment).
                                                        </p>
                                                    ) : (
                                                        <table className="w-full text-left text-sm">
                                                            <thead>
                                                                <tr className="border-b border-gray-200 text-gray-600">
                                                                    <th className="pb-2 font-medium">Date</th>
                                                                    <th className="pb-2 font-medium">Inst</th>
                                                                    <th className="pb-2 font-medium">Type</th>
                                                                    <th className="pb-2 font-medium">Method</th>
                                                                    <th className="pb-2 font-medium text-right">Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {txsHere.map(
                                                                    (tx: {
                                                                        _id: string;
                                                                        paymentDate?: string;
                                                                        installmentNo?: number;
                                                                        planKind?: string;
                                                                        paymentMethod?: string;
                                                                        amount?: number;
                                                                    }) => (
                                                                        <tr key={tx._id} className="border-b border-gray-50">
                                                                            <td className="py-2">
                                                                                {tx.paymentDate
                                                                                    ? new Date(tx.paymentDate).toLocaleDateString()
                                                                                    : '—'}
                                                                            </td>
                                                                            <td className="py-2">#{tx.installmentNo ?? '—'}</td>
                                                                            <td className="py-2">
                                                                                {tx.planKind === 'addon' ? 'Add-on' : 'Main'}
                                                                            </td>
                                                                            <td className="py-2 uppercase text-gray-600">
                                                                                {tx.paymentMethod}
                                                                            </td>
                                                                            <td className="py-2 text-right font-medium">
                                                                                {fmt(Number(tx.amount))}
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>

                                                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
                                                    <h3 className="font-bold text-gray-800 mb-3">Invoices (this project)</h3>
                                                    {invHere.length === 0 ? (
                                                        <p className="text-sm text-gray-500">
                                                            No invoices with this project name on the line item. All
                                                            customer invoices still appear under Payments & Billing.
                                                        </p>
                                                    ) : (
                                                        <ul className="space-y-2 text-sm">
                                                            {invHere.map((inv) => (
                                                                <li
                                                                    key={inv._id}
                                                                    className="flex justify-between border border-gray-100 rounded-lg px-3 py-2"
                                                                >
                                                                    <span>{inv.invoiceNumber}</span>
                                                                    <span>{fmt(inv.totalAmount)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
                                    <p className="mb-3">This project is no longer linked or could not be loaded.</p>
                                    <button
                                        type="button"
                                        onClick={() => setCashflowProjectId(null)}
                                        className="text-orange-600 font-medium hover:underline"
                                    >
                                        Back to all projects
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="flex flex-col gap-4">
                            <p className="text-sm text-gray-600 px-1">
                                Data here is loaded from your database for this customer ID:{' '}
                                <strong>linked projects</strong> (each project stores this customer as client), then{' '}
                                <strong>payment plans</strong> and <strong>installments</strong> on those projects, plus{' '}
                                <strong>invoices</strong> and <strong>payment transactions</strong> recorded for this client.
                            </p>
                            {projects.length === 0 ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                                    <p className="font-semibold mb-1">No projects linked yet</p>
                                    <p className="text-amber-900/90 mb-2">
                                        Payment plans and installments only appear after at least one project is created with this customer selected.
                                        Proposals and invoices also tie to the customer through inquiries and billing flows.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/projects?newProjectForCustomer=${customer._id}`)}
                                        className={styles.orangeBtn}
                                    >
                                        Start a project for this customer
                                    </button>
                                </div>
                            ) : paymentPlans.length === 0 ? (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                                    <p className="font-semibold mb-1">Projects exist — no payment plans yet</p>
                                    <p>
                                        Open a project and generate a <strong>main payment plan</strong> from a template (or add requirement{' '}
                                        <strong>add-on plans</strong> from requirement workflow). Installments and customer notifications follow those plans.
                                    </p>
                                </div>
                            ) : null}
                            {/* Payment plans: main contract vs add-ons */}
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                                <button 
                                    onClick={() => setExpandedPaymentSection(expandedPaymentSection === 'plans' ? ('' as any) : 'plans')}
                                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                        Payment plans ({paymentPlans.filter((p) => p.status === 'active').length} active)
                                    </h3>
                                </button>
                                {expandedPaymentSection === 'plans' && (
                                    <div className="p-6 border-t border-gray-100 space-y-6">
                                                <div>
                                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Main contract (per project)</h4>
                                            {mainCustomerPlans.length === 0 ? (
                                                <p className="text-gray-500 text-sm">No main payment plans.</p>
                                            ) : (
                                                mainCustomerPlans.map((plan: any) => (
                                                    <div
                                                        key={plan._id}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => plan.projectId && navigate(`/projects/${plan.projectId}`)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && plan.projectId) navigate(`/projects/${plan.projectId}`);
                                                        }}
                                                        className="mb-3 p-3 bg-white border border-gray-200 rounded-lg flex justify-between items-center cursor-pointer hover:border-orange-200"
                                                    >
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-800">
                                                                {plan.projectName || 'Project'} · main #{String(plan._id).slice(-6)}
                                                </div>
                                                            <div className="text-xs text-gray-500">
                                                                Down Rs. {Number(plan.downPaymentAmt || 0).toLocaleString()} · balance Rs.{' '}
                                                                {Number(plan.remainingBalance || 0).toLocaleString()}
                                            </div>
                                                        </div>
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                                                plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                            }`}
                                                        >
                                                            {plan.status}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">
                                                Value-added requirements (separate billing)
                                            </h4>
                                            {addonCustomerPlans.length === 0 ? (
                                                <p className="text-gray-500 text-sm">No add-on plans yet.</p>
                                            ) : (
                                                addonCustomerPlans.map((plan: any) => (
                                                    <div
                                                        key={plan._id}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => plan.projectId && navigate(`/projects/${plan.projectId}`)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && plan.projectId) navigate(`/projects/${plan.projectId}`);
                                                        }}
                                                        className="mb-3 p-3 bg-amber-50/60 border border-amber-200 rounded-lg flex justify-between items-center cursor-pointer hover:border-amber-300"
                                                    >
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-900">
                                                                {plan.projectName || 'Project'} · add-on #{String(plan._id).slice(-6)}
                                                            </div>
                                                            <div className="text-xs text-gray-600">
                                                                Req. {plan.linkedRequirementId ? String(plan.linkedRequirementId).slice(-6) : '—'} · down Rs.{' '}
                                                                {Number(plan.downPaymentAmt || 0).toLocaleString()} ·{' '}
                                                                {Number(plan.totalInstallments || 0)} installments
                                                            </div>
                                                        </div>
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                                                plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                            }`}
                                                        >
                                                            {plan.status}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pending installments across all linked projects */}
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                                <button
                                    onClick={() =>
                                        setExpandedPaymentSection(
                                            expandedPaymentSection === 'installments_pending' ? ('' as any) : 'installments_pending'
                                        )
                                    }
                                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                        Upcoming installments (pending){' '}
                                        <span className="text-gray-500 font-normal">({pendingInstallments.length})</span>
                                    </h3>
                                </button>
                                {expandedPaymentSection === 'installments_pending' && (
                                    <div className="p-6 border-t border-gray-100 overflow-x-auto">
                                        {pendingInstallments.length === 0 ? (
                                            <p className="text-gray-500 text-sm">No pending installments for this customer&apos;s projects.</p>
                                        ) : (
                                            <table className="w-full text-left text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-200 text-gray-600">
                                                        <th className="pb-3 font-medium">Project</th>
                                                        <th className="pb-3 font-medium">Type</th>
                                                        <th className="pb-3 font-medium">Inst #</th>
                                                        <th className="pb-3 font-medium">Due</th>
                                                        <th className="pb-3 font-medium text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pendingInstallments.slice(0, 40).map((inst: any) => (
                                                        <tr key={inst._id} className="border-b border-gray-100 last:border-0">
                                                            <td className="py-2 text-gray-900">{inst.projectName || '—'}</td>
                                                            <td className="py-2 text-gray-600">
                                                                {inst.planKind === 'addon' ? 'Add-on' : 'Main'}
                                                            </td>
                                                            <td className="py-2">#{inst.installmentNo}</td>
                                                            <td className="py-2 text-gray-600">
                                                                {inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : '—'}
                                                            </td>
                                                            <td className="py-2 text-right font-medium">
                                                                Rs. {Number(inst.dueAmount || 0).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                        {pendingInstallments.length > 40 && (
                                            <p className="text-xs text-gray-500 mt-2">Showing first 40. Open Installments for the full list.</p>
                                        )}
                                        <div className="mt-4">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/installments?clientId=${id}&status=pending`)}
                                                className={styles.orangeBtn}
                                                style={{ background: '#4b5563', color: 'white', width: 'auto' }}
                                            >
                                                Open installments
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Transaction History Accordion */}
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                                <button 
                                    onClick={() => setExpandedPaymentSection(expandedPaymentSection === 'history' ? '' as any : 'history')}
                                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                        Transaction History ({transactions.length})
                                    </h3>
                                </button>
                                {expandedPaymentSection === 'history' && (
                                    <div className="p-6 border-t border-gray-100 overflow-x-auto">
                                        {transactions.length === 0 ? <p className="text-gray-500 text-sm">No transaction records found.</p> : (
                                            <table className="w-full text-left text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-200 text-gray-600">
                                                        <th className="pb-3 font-medium">Date</th>
                                                        <th className="pb-3 font-medium">Ref</th>
                                                        <th className="pb-3 font-medium">Method</th>
                                                        <th className="pb-3 font-medium text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {transactions.map(tx => (
                                                        <tr key={tx._id} className="border-b border-gray-100 last:border-0">
                                                            <td className="py-3 text-gray-900">{tx.paymentDate ? new Date(tx.paymentDate).toLocaleDateString() : '-'}</td>
                                                            <td className="py-3 text-gray-500">{tx.referenceNo || '-'}</td>
                                                            <td className="py-3 text-gray-500 uppercase">{tx.paymentMethod}</td>
                                                            <td className="py-3 text-right font-medium text-gray-900">Rs. {Number(tx.amount || 0).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Overdue Accordion */}
                            <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
                                <button 
                                    onClick={() => setExpandedPaymentSection(expandedPaymentSection === 'overdue' ? '' as any : 'overdue')}
                                    className="w-full px-6 py-4 flex items-center justify-between bg-red-50 hover:bg-red-100 transition-colors"
                                >
                                    <h3 className="font-bold text-red-700 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-red-600"></span>
                                        Overdue Payments & Installments
                                    </h3>
                                </button>
                                {expandedPaymentSection === 'overdue' && (
                                    <div className="p-6 border-t border-red-100">
                                        {overdueInstallments.length === 0 ? <p className="text-gray-500 text-sm">No overdue payments found.</p> : (
                                            <table className="w-full text-left text-sm">
                                                <thead>
                                                    <tr className="border-b border-red-100 text-gray-600">
                                                        <th className="pb-3 font-medium">Inst #</th>
                                                        <th className="pb-3 font-medium">Due Date</th>
                                                        <th className="pb-3 font-medium text-right">Due Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {overdueInstallments.map(inst => (
                                                        <tr key={inst._id} className="border-b border-red-50 last:border-0">
                                                            <td className="py-3 text-red-900 font-medium">#{inst.installmentNo}</td>
                                                            <td className="py-3 text-red-700">{inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : '-'}</td>
                                                            <td className="py-3 text-right font-bold text-red-700">Rs. {Number(inst.dueAmount - (inst.paidAmount || 0)).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Invoices Accordion */}
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                                <button 
                                    onClick={() => setExpandedPaymentSection(expandedPaymentSection === 'invoices' ? '' as any : 'invoices')}
                                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-orange-400"></span>
                                        Invoices ({invoices.length})
                                    </h3>
                                </button>
                                {expandedPaymentSection === 'invoices' && (
                                    <div className="p-6 border-t border-gray-100">
                                        {invoices.length === 0 ? <p className="text-gray-500 text-sm">No invoices found.</p> : (
                                            <div className="flex flex-col gap-2">
                                                {invoices.map(inv => (
                                                    <div key={inv._id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg bg-gray-50">
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-900">{inv.invoiceNumber}</div>
                                                            <div className="text-xs text-gray-500">Amount: Rs. {Number(inv.totalAmount || 0).toLocaleString()}</div>
                                                        </div>
                                                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                            {inv.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <button onClick={() => navigate('/invoices')} className={styles.orangeBtn} style={{ background: '#4b5563', color: 'white', width: 'auto' }}>
                                                View Statement
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className={styles.mainCard}>
                            <div className={styles.cardHeader}>
                                <h2 className={styles.cardTitle}>Interaction Timeline</h2>
                            </div>
                            <div className={styles.timelineList}>
                                {interactions.length === 0 ? (
                                    <p className={styles.emptyText}>No interactions recorded yet.</p>
                                ) : (
                                    interactions.map((item) => (
                                        <div key={item._id} className={styles.timelineItem}>
                                            <div className={styles.timelineType}>{item.type.replace('_', ' ')}</div>
                                            <div className={styles.timelineSummary}>{item.summary}</div>
                                            {item.details && <div className={styles.timelineDetails}>{item.details}</div>}
                                            <div className={styles.timelineDate}>{new Date(item.occurredAt).toLocaleString()}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'calls' && (
                        <div className={styles.mainCard}>
                            <div className={styles.cardHeader}>
                                <h2 className={styles.cardTitle}>Call Logs</h2>
                            </div>
                            <div className={styles.entryForm}>
                                <input
                                    className={styles.inputParam}
                                    placeholder="Call summary (or leave blank to use first line of notes)"
                                    value={newCall.summary}
                                    onChange={(e) => setNewCall({ ...newCall, summary: e.target.value })}
                                />
                                <textarea
                                    className={styles.inputParam}
                                    placeholder="Call notes"
                                    value={newCall.details}
                                    onChange={(e) => setNewCall({ ...newCall, details: e.target.value })}
                                    rows={3}
                                />
                                <div className={styles.inlineGrid}>
                                    <select className={styles.inputParam} value={newCall.direction} onChange={(e) => setNewCall({ ...newCall, direction: e.target.value as 'INBOUND' | 'OUTBOUND' })}>
                                        <option value="OUTBOUND">Outbound</option>
                                        <option value="INBOUND">Inbound</option>
                                    </select>
                                    <div className={styles.durationField}>
                                        <input
                                            className={styles.inputParam}
                                            type="text"
                                            inputMode="numeric"
                                            value={newCall.durationAmount}
                                            onChange={(e) => setNewCall({ ...newCall, durationAmount: e.target.value })}
                                            placeholder="Duration (integer)"
                                            aria-label="Call duration amount"
                                        />
                                        <select
                                            className={styles.inputParam}
                                            value={newCall.durationUnit}
                                            onChange={(e) => setNewCall({ ...newCall, durationUnit: e.target.value as CallDurationUnit })}
                                            aria-label="Call duration unit"
                                            title="Seconds, minutes, or hours"
                                        >
                                            <option value="seconds">Sec</option>
                                            <option value="minutes">Min</option>
                                            <option value="hours">Hr</option>
                                        </select>
                                    </div>
                                    <select className={styles.inputParam} value={newCall.outcome} onChange={(e) => setNewCall({ ...newCall, outcome: e.target.value as 'ANSWERED' | 'NO_ANSWER' | 'VOICEMAIL' | 'FOLLOW_UP_REQUIRED' | 'CLOSED' })}>
                                        <option value="ANSWERED">Answered</option>
                                        <option value="NO_ANSWER">No Answer</option>
                                        <option value="VOICEMAIL">Voicemail</option>
                                        <option value="FOLLOW_UP_REQUIRED">Follow-Up</option>
                                        <option value="CLOSED">Closed</option>
                                    </select>
                                </div>
                                <button className={styles.orangeBtn} onClick={addCallLog}>Add Call Log</button>
                            </div>
                            <div className={styles.timelineList}>
                                {callLogs.length === 0 ? (
                                    <p className={styles.emptyText}>No call logs yet.</p>
                                ) : (
                                    callLogs.map((log) => (
                                        <div key={log._id} className={styles.timelineItem}>
                                            <div className={styles.requirementRow}>
                                                <div className={styles.requirementRowBody}>
                                                    {editingCallLogId === log._id ? (
                                                        <>
                                                            <input
                                                                className={styles.inputParam}
                                                                placeholder="Call summary (or leave blank to use first line of notes)"
                                                                value={editCallForm.summary}
                                                                onChange={(e) => setEditCallForm({ ...editCallForm, summary: e.target.value })}
                                                            />
                                                            <textarea
                                                                className={styles.inputParam}
                                                                style={{ marginTop: '0.5rem' }}
                                                                placeholder="Call notes"
                                                                value={editCallForm.details}
                                                                onChange={(e) => setEditCallForm({ ...editCallForm, details: e.target.value })}
                                                                rows={3}
                                                            />
                                                            <div className={styles.inlineGrid} style={{ marginTop: '0.5rem' }}>
                                                                <select
                                                                    className={styles.inputParam}
                                                                    value={editCallForm.direction}
                                                                    onChange={(e) =>
                                                                        setEditCallForm({ ...editCallForm, direction: e.target.value as 'INBOUND' | 'OUTBOUND' })
                                                                    }
                                                                >
                                                                    <option value="OUTBOUND">Outbound</option>
                                                                    <option value="INBOUND">Inbound</option>
                                                                </select>
                                                                <div className={styles.durationField}>
                                                                    <input
                                                                        className={styles.inputParam}
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={editCallForm.durationAmount}
                                                                        onChange={(e) => setEditCallForm({ ...editCallForm, durationAmount: e.target.value })}
                                                                        placeholder="Duration (integer)"
                                                                        aria-label="Call duration amount"
                                                                    />
                                                                    <select
                                                                        className={styles.inputParam}
                                                                        value={editCallForm.durationUnit}
                                                                        onChange={(e) =>
                                                                            setEditCallForm({
                                                                                ...editCallForm,
                                                                                durationUnit: e.target.value as CallDurationUnit,
                                                                            })
                                                                        }
                                                                        aria-label="Call duration unit"
                                                                        title="Seconds, minutes, or hours"
                                                                    >
                                                                        <option value="seconds">Sec</option>
                                                                        <option value="minutes">Min</option>
                                                                        <option value="hours">Hr</option>
                                                                    </select>
                                                                </div>
                                                                <select
                                                                    className={styles.inputParam}
                                                                    value={editCallForm.outcome}
                                                                    onChange={(e) =>
                                                                        setEditCallForm({
                                                                            ...editCallForm,
                                                                            outcome: e.target.value as typeof editCallForm.outcome,
                                                                        })
                                                                    }
                                                                >
                                                                    <option value="ANSWERED">Answered</option>
                                                                    <option value="NO_ANSWER">No Answer</option>
                                                                    <option value="VOICEMAIL">Voicemail</option>
                                                                    <option value="FOLLOW_UP_REQUIRED">Follow-Up</option>
                                                                    <option value="CLOSED">Closed</option>
                                                                </select>
                                                            </div>
                                                            <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <button type="button" className={styles.saveBtn} onClick={saveEditCallLog}>
                                                                    Save
                                                                </button>
                                                                <button type="button" className={styles.editBtn} onClick={cancelEditCallLog}>
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className={styles.timelineSummary}>{log.summary}</div>
                                                            {log.details && <div className={styles.timelineDetails}>{log.details}</div>}
                                                            <div className={styles.timelineMeta}>
                                                                <span>{log.callMeta?.direction || '-'}</span>
                                                                <span title={log.callMeta?.durationSec != null ? `${log.callMeta.durationSec} seconds stored` : undefined}>
                                                                    {formatCallDurationSeconds(log.callMeta?.durationSec)}
                                                                </span>
                                                                <span>{log.callMeta?.outcome || '-'}</span>
                                                            </div>
                                                            <div className={styles.timelineDate}>{new Date(log.occurredAt).toLocaleString()}</div>
                                                        </>
                                                    )}
                                                </div>
                                                {editingCallLogId !== log._id && (
                                                    <div className={styles.requirementActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.requirementIconBtn}
                                                            title="Edit call log"
                                                            aria-label="Edit call log"
                                                            onClick={() => startEditCallLog(log)}
                                                        >
                                                            <Pencil size={18} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`${styles.requirementIconBtn} ${styles.requirementIconBtnDanger}`}
                                                            title="Delete call log"
                                                            aria-label="Delete call log"
                                                            onClick={() => setDeleteCallLogId(log._id)}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'requirements' && (
                        <div className={styles.mainCard}>
                            <div className={styles.cardHeader}>
                                <h2 className={styles.cardTitle}>Software Requirements Discussed</h2>
                            </div>
                            <div className={styles.entryForm}>
                                <input
                                    className={styles.inputParam}
                                    placeholder="Requirement title"
                                    value={newRequirement.title}
                                    onChange={(e) => setNewRequirement({ ...newRequirement, title: e.target.value })}
                                />
                                <textarea
                                    className={styles.inputParam}
                                    placeholder="Requirement description"
                                    value={newRequirement.description}
                                    onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                                    rows={3}
                                />
                                <select
                                    className={styles.inputParam}
                                    value={newRequirement.projectRef}
                                    onChange={(e) => setNewRequirement({ ...newRequirement, projectRef: e.target.value })}
                                >
                                    <option value="">Link to project (optional)</option>
                                    {projects.map((p) => (
                                        <option key={p._id} value={p._id}>
                                            {p.projectName}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    className={styles.inputParam}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="Requirement value LKR (optional — refine on workflow)"
                                    value={newRequirement.requirementPayoutValue}
                                    onChange={(e) =>
                                        setNewRequirement({ ...newRequirement, requirementPayoutValue: e.target.value })
                                    }
                                />
                                <div className={styles.inlineGrid}>
                                    <select className={styles.inputParam} value={newRequirement.priority} onChange={(e) => setNewRequirement({ ...newRequirement, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' })}>
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                    <select className={styles.inputParam} value={newRequirement.status} onChange={(e) => setNewRequirement({ ...newRequirement, status: e.target.value as 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DEFERRED' })}>
                                        <option value="OPEN">Open</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="DONE">Done</option>
                                        <option value="DEFERRED">Deferred</option>
                                    </select>
                                    <select className={styles.inputParam} value={newRequirement.source} onChange={(e) => setNewRequirement({ ...newRequirement, source: e.target.value as 'INQUIRY' | 'CALL' | 'MEETING' | 'MANUAL' })}>
                                        <option value="MANUAL">Manual</option>
                                        <option value="INQUIRY">Inquiry</option>
                                        <option value="CALL">Call</option>
                                        <option value="MEETING">Meeting</option>
                                    </select>
                                </div>
                                <button className={styles.orangeBtn} onClick={addRequirement}>Add Requirement</button>
                            </div>
                            <div className={styles.timelineList}>
                                {requirements.length === 0 ? (
                                    <p className={styles.emptyText}>No requirements tracked yet.</p>
                                ) : (
                                    requirements.map((reqItem) => (
                                        <div key={reqItem._id} className={styles.timelineItem}>
                                            <div className={styles.requirementRow}>
                                                <div className={styles.requirementRowBody}>
                                                    {editingRequirementId === reqItem._id ? (
                                                        <>
                                                            <input
                                                                className={styles.inputParam}
                                                                value={editRequirementForm.title}
                                                                onChange={(e) => setEditRequirementForm({ ...editRequirementForm, title: e.target.value })}
                                                                placeholder="Title"
                                                            />
                                                            <textarea
                                                                className={styles.inputParam}
                                                                style={{ marginTop: '0.5rem' }}
                                                                rows={3}
                                                                value={editRequirementForm.description}
                                                                onChange={(e) => setEditRequirementForm({ ...editRequirementForm, description: e.target.value })}
                                                                placeholder="Description"
                                                            />
                                                            <div className={styles.inlineGrid} style={{ marginTop: '0.5rem' }}>
                                                                <select className={styles.inputParam} value={editRequirementForm.priority} onChange={(e) => setEditRequirementForm({ ...editRequirementForm, priority: e.target.value as typeof editRequirementForm.priority })}>
                                                                    <option value="LOW">Low</option>
                                                                    <option value="MEDIUM">Medium</option>
                                                                    <option value="HIGH">High</option>
                                                                    <option value="CRITICAL">Critical</option>
                                                                </select>
                                                                <select className={styles.inputParam} value={editRequirementForm.status} onChange={(e) => setEditRequirementForm({ ...editRequirementForm, status: e.target.value as typeof editRequirementForm.status })}>
                                                                    <option value="OPEN">Open</option>
                                                                    <option value="IN_PROGRESS">In Progress</option>
                                                                    <option value="DONE">Done</option>
                                                                    <option value="DEFERRED">Deferred</option>
                                                                </select>
                                                                <select className={styles.inputParam} value={editRequirementForm.source} onChange={(e) => setEditRequirementForm({ ...editRequirementForm, source: e.target.value as typeof editRequirementForm.source })}>
                                                                    <option value="MANUAL">Manual</option>
                                                                    <option value="CUSTOMER">Customer request</option>
                                                                    <option value="INQUIRY">Inquiry</option>
                                                                    <option value="CALL">Call</option>
                                                                    <option value="MEETING">Meeting</option>
                                                                </select>
                                                            </div>
                                                            <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <button type="button" className={styles.saveBtn} onClick={saveEditRequirement}>Save</button>
                                                                <button type="button" className={styles.editBtn} onClick={cancelEditRequirement}>Cancel</button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className={styles.timelineSummary}>{reqItem.title}</div>
                                                            {reqItem.description && <div className={styles.timelineDetails}>{reqItem.description}</div>}
                                                            <div className={styles.timelineMeta}>
                                                                <span>{reqItem.priority}</span>
                                                                <span>{reqItem.status}</span>
                                                                <span>{reqItem.source}</span>
                                                            </div>
                                                            {reqItem.requirementPayoutValue != null &&
                                                            Number(reqItem.requirementPayoutValue) > 0 ? (
                                                                <div className="text-xs text-emerald-800 mt-1">
                                                                    Value LKR {Number(reqItem.requirementPayoutValue).toLocaleString()}
                                                                </div>
                                                            ) : null}
                                                            {reqItem.projectRef ? (
                                                                <Link
                                                                    to={`/projects/${reqItem.projectRef}/requirement-workflow`}
                                                                    className="text-xs font-semibold text-orange-600 hover:underline mt-1 inline-block"
                                                                >
                                                                    Open requirement workflow
                                                                </Link>
                                                            ) : null}
                                                            <div className={styles.timelineDate}>{new Date(reqItem.capturedAt).toLocaleString()}</div>
                                                        </>
                                                    )}
                                                </div>
                                                {editingRequirementId !== reqItem._id && (
                                                    <div className={styles.requirementActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.requirementIconBtn}
                                                            title="Edit requirement"
                                                            aria-label="Edit requirement"
                                                            onClick={() => startEditRequirement(reqItem)}
                                                        >
                                                            <Pencil size={18} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`${styles.requirementIconBtn} ${styles.requirementIconBtnDanger}`}
                                                            title="Delete requirement"
                                                            aria-label="Delete requirement"
                                                            onClick={() => setDeleteRequirementId(reqItem._id)}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={showDeleteModal}
                title="Delete Customer"
                message="Are you sure you want to delete this customer? This action cannot be undone."
                confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteModal(false)}
                danger
            />

            <ConfirmDialog
                open={!!deleteRequirementId}
                title="Delete requirement"
                message="Remove this software requirement from the customer profile? This cannot be undone."
                confirmLabel={deletingRequirement ? 'Deleting…' : 'Delete'}
                onConfirm={confirmDeleteRequirement}
                onCancel={() => !deletingRequirement && setDeleteRequirementId(null)}
                danger
                isLoading={deletingRequirement}
            />

            <ConfirmDialog
                open={!!deleteCallLogId}
                title="Delete call log"
                message="Remove this call log from the customer profile? This cannot be undone."
                confirmLabel={deletingCallLog ? 'Deleting…' : 'Delete'}
                onConfirm={confirmDeleteCallLog}
                onCancel={() => !deletingCallLog && setDeleteCallLogId(null)}
                danger
                isLoading={deletingCallLog}
            />
        </div>
    );
}
