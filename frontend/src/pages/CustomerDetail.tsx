import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Edit3,
    Trash2,
    FolderKanban,
    Pencil,
} from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { SOFTWARE_PRODUCT_OPTIONS } from '../constants/customerServiceProducts';
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
    source: 'INQUIRY' | 'CALL' | 'MEETING' | 'MANUAL';
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

export default function CustomerDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [overdueInstallments, setOverdueInstallments] = useState<any[]>([]);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [callLogs, setCallLogs] = useState<Interaction[]>([]);
    const [requirements, setRequirements] = useState<CustomerRequirement[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'details' | 'projects' | 'payments' | 'history' | 'calls' | 'requirements'>('details');
    // Collapsible states for payments
    const [expandedPaymentSection, setExpandedPaymentSection] = useState<'plans' | 'history' | 'overdue' | 'invoices'>('plans');
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
        source: 'MANUAL' as 'INQUIRY' | 'CALL' | 'MEETING' | 'MANUAL',
    });

    const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null);
    const [editRequirementForm, setEditRequirementForm] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        status: 'OPEN' as 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DEFERRED',
        source: 'MANUAL' as 'INQUIRY' | 'CALL' | 'MEETING' | 'MANUAL',
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

    const load = async () => {
        if (!id) return;
        try {
            const custRes = await api.get<Customer>(`/customers/${id}`);
            if (custRes.success && custRes.data) {
                setCustomer(custRes.data);
                setEditForm(custRes.data);
            }
            const projRes = await api.get<Project[]>(`/projects?clientId=${id}`);
            if (projRes.success && projRes.data) {
                setProjects(projRes.data);
            }
            const invRes = await api.get<Invoice[]>(`/invoices?clientId=${id}`);
            if (invRes.success && invRes.data) {
                setInvoices(invRes.data);
            }
            const plansRes = await api.get<any[]>(`/payment-plans?clientId=${id}`); // Assuming a way to get by client or we extract from projects
            if (plansRes.success && plansRes.data) setPaymentPlans(plansRes.data);
            
            const txRes = await api.get<any[]>(`/payments?clientId=${id}`);
            if (txRes.success && txRes.data) setTransactions(txRes.data);

            const overdueRes = await api.get<any[]>(`/installments?clientId=${id}&status=overdue`);
            if (overdueRes.success && overdueRes.data) setOverdueInstallments(overdueRes.data);
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

    useEffect(() => { load(); }, [id]);

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
        const res = await api.post<CustomerRequirement>(`/customers/${id}/requirements`, newRequirement);
        if (res.success) {
            setNewRequirement({
                title: '',
                description: '',
                priority: 'MEDIUM',
                status: 'OPEN',
                source: 'MANUAL',
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
                                <h2 className="text-lg font-bold text-gray-800">Linked Projects</h2>
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
                                            <span className={`px-3 py-1 text-xs rounded-full font-semibold uppercase tracking-wider ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                                                {p.status}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="flex flex-col gap-4">
                            {/* Payment Plans Accordion */}
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                                <button 
                                    onClick={() => setExpandedPaymentSection(expandedPaymentSection === 'plans' ? '' as any : 'plans')}
                                    className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                        Active Payment Plans ({paymentPlans.filter(p => p.status === 'active').length})
                                    </h3>
                                </button>
                                {expandedPaymentSection === 'plans' && (
                                    <div className="p-6 border-t border-gray-100">
                                        {/* Simplified list of Payment Plans */}
                                        {paymentPlans.length === 0 ? <p className="text-gray-500 text-sm">No payment plans found.</p> : paymentPlans.map(plan => (
                                            <div key={plan._id} className="mb-3 p-3 bg-white border border-gray-200 rounded-lg flex justify-between items-center">
                                                <div>
                                                    <div className="font-medium text-sm text-gray-800">Plan #{plan._id.slice(-6)}</div>
                                                    <div className="text-xs text-gray-500">Balance: Rs. {Number(plan.remainingBalance || 0).toLocaleString()}</div>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{plan.status}</span>
                                            </div>
                                        ))}
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
