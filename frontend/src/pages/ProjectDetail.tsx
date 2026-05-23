import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    ChevronDown,
    Edit3,
    Trash2,
    List,
    DollarSign,
    CheckSquare,
    Download,
} from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import {
    normalizeProjectStatus,
    isProjectUnderDevelopment,
    type ProjectLifecycleStatus,
} from '../types/projectLifecycle';
import styles from './ProjectDetail.module.css';

interface Project {
    _id: string;
    clientId: string;
    clientName?: string;
    projectName: string;
    description?: string;
    systemType?: string;
    totalValue: number;
    expenses?: number;
    totalDeveloperPayouts?: number;
    netProfit?: number;
    startDate?: string;
    endDate?: string;
    assignedEmployees?: string[];
    assignedEmployeePayouts?: Record<string, number>;
    assignedEmployeePayoutRelease?: Record<string, 'accruing' | 'submitted' | 'released'>;
    status: ProjectLifecycleStatus;
    requirementWorkflowLabel?: 'none' | 'to_be_updated' | 'updated';
}

interface UserOption {
    _id: string;
    name: string;
    email: string;
}

interface PaymentPlanTemplate {
    _id: string;
    name: string;
    templateType: string;
    description?: string;
}

interface PaymentPlan {
    _id: string;
    status: string;
    downPaymentAmt: number;
    planKind?: 'primary' | 'addon';
    linkedRequirementId?: string;
    totalInstallments?: number;
    installmentAmt?: number;
    remainingBalance?: number;
    downPaymentPct?: number;
    projectName?: string;
}

interface Installment {
    _id: string;
    installmentNo: number;
    dueDate: string;
    dueAmount: number;
    status: string;
    planKind?: 'primary' | 'addon';
    projectName?: string;
}


function sumPayoutMap(map: Record<string, number> | undefined): number {
    if (!map) return 0;
    return Object.values(map).reduce((s, v) => s + (Number.isFinite(Number(v)) ? Number(v) : 0), 0);
}

const getStatusColor = (status: string) => {
    const s = normalizeProjectStatus(status);
    if (s === 'under_development') return 'bg-[#dcfce7] text-green-600 border-transparent';
    if (s === 'completed') return 'bg-[#dbeafe] text-blue-600 border-transparent';
    if (s === 'unassigned') return 'bg-amber-50 text-amber-900 border-amber-200';
    if (s === 'suspended') return 'bg-[#fee2e2] text-red-600 border-transparent';
    return 'bg-white text-gray-700 border-gray-200';
};

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') === 'assignments' ? 'assignments' : 'details';
    const [activeTab, setActiveTab] = useState<'details' | 'assignments'>(initialTab);

    const [project, setProject] = useState<Project | null>(null);
    const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
    /** Installments for the selected main (primary) contract plan. */
    const [mainInstallments, setMainInstallments] = useState<Installment[]>([]);
    /** Each add-on requirement payment plan and its installments (separate from main contract). */
    const [addonPlanInstallments, setAddonPlanInstallments] = useState<{ plan: PaymentPlan; installments: Installment[] }[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [templates, setTemplates] = useState<PaymentPlanTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Project>>({});
    
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [generatingPlan, setGeneratingPlan] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [downloadingFinancial, setDownloadingFinancial] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [systemPopup, setSystemPopup] = useState<{ title: string; message: string } | null>(null);
    const [payoutActionKey, setPayoutActionKey] = useState<string | null>(null);

    const load = async () => {
        if (!id) return;
        try {
            const [projRes, planRes, usersRes, tplRes] = await Promise.all([
                api.get<Project>(`/projects/${id}`),
                api.get<PaymentPlan[]>(`/payment-plans?projectId=${id}`),
                api.get<UserOption[]>('/users'),
                api.get<PaymentPlanTemplate[]>('/payment-plan-templates')
            ]);
            
            if (projRes.success && projRes.data) {
                setProject(projRes.data);
                setEditForm({
                    projectName: projRes.data.projectName,
                    description: projRes.data.description,
                    systemType: projRes.data.systemType,
                    totalValue: projRes.data.totalValue,
                    expenses: projRes.data.expenses ?? 0,
                    startDate: projRes.data.startDate ? projRes.data.startDate.slice(0, 10) : '',
                    endDate: projRes.data.endDate ? projRes.data.endDate.slice(0, 10) : '',
                    status: projRes.data.status,
                    assignedEmployees: projRes.data.assignedEmployees || [],
                    assignedEmployeePayouts: projRes.data.assignedEmployeePayouts || {},
                });
            }

            if (usersRes.success && usersRes.data) setUsers(usersRes.data);
            if (tplRes.success && tplRes.data) setTemplates(tplRes.data);

            if (planRes.success && planRes.data) {
                const plans = planRes.data;
                setPaymentPlans(plans);
                const primaryPlans = plans.filter((p) => (p.planKind ?? 'primary') === 'primary');
                const addonPlans = plans.filter((p) => p.planKind === 'addon');

                const pickMainPlan = (): PaymentPlan | null => {
                    const active = primaryPlans.filter((p) => p.status === 'active');
                    const pool = active.length > 0 ? active : primaryPlans;
                    if (pool.length === 0) return null;
                    return [...pool].sort((a, b) => String(a._id).localeCompare(String(b._id)))[0];
                };
                const mainPlan = pickMainPlan();
                if (mainPlan?._id) {
                    const instRes = await api.get<Installment[]>(`/installments?planId=${mainPlan._id}`);
                    setMainInstallments(instRes.success && instRes.data ? instRes.data : []);
                } else {
                    setMainInstallments([]);
                }

                const bundles: { plan: PaymentPlan; installments: Installment[] }[] = [];
                for (const plan of addonPlans) {
                    const ir = await api.get<Installment[]>(`/installments?planId=${plan._id}`);
                    bundles.push({ plan, installments: ir.success && ir.data ? ir.data : [] });
                }
                setAddonPlanInstallments(bundles);
            } else {
                setPaymentPlans([]);
                setMainInstallments([]);
                setAddonPlanInstallments([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'assignments') {
            setActiveTab('assignments');
        } else {
            setActiveTab('details');
        }
        if (searchParams.get('edit') === '1') {
            setIsEditing(true);
        }
    }, [searchParams]);

    const updateStatus = async (status: string) => {
        if (!id || !project) return;
        setProject({ ...project, status: status as ProjectLifecycleStatus });
        const res = await api.patch<Project>(`/projects/${id}`, { status });
        if (!res.success) load();
    };

    const handleSave = async () => {
        if (!id) return;
        try {
            const selectedEmployees = editForm.assignedEmployees || [];
            const payoutMap = (editForm.assignedEmployeePayouts || {}) as Record<string, number>;
            const isActiveProject = isProjectUnderDevelopment(String(editForm.status || project?.status));
            const canManagePayouts = user?.role === 'owner' || user?.role === 'pm';
            const prevAssigneeCount = project?.assignedEmployees?.length ?? 0;
            const assigneesJustAdded =
                selectedEmployees.length > 0 && prevAssigneeCount === 0;
            if (canManagePayouts && selectedEmployees.length > 0 && (isActiveProject || assigneesJustAdded)) {
                const missing = selectedEmployees.filter((empId) => {
                    const amount = Number(payoutMap[empId]);
                    return !Number.isFinite(amount) || amount <= 0;
                });
                if (missing.length > 0) {
                    setSystemPopup({
                        title: 'Payout value required',
                        message:
                            'Please enter a valid payout for each assigned developer (required for under-development projects and when assigning the first developers).',
                    });
                    return;
                }
            }
            const dateFieldForApi = (v: string | undefined): string => {
                const s = typeof v === 'string' ? v.trim() : '';
                if (!s) return '';
                const d = new Date(`${s}T12:00:00.000Z`);
                return Number.isNaN(d.getTime()) ? '' : d.toISOString();
            };
            const payload = {
                projectName: editForm.projectName,
                description: editForm.description,
                systemType: editForm.systemType,
                totalValue: editForm.totalValue ? Number(editForm.totalValue) : undefined,
                ...(user?.role === 'owner'
                    ? { expenses: Math.max(0, Number(editForm.expenses ?? project?.expenses ?? 0)) }
                    : {}),
                startDate: dateFieldForApi(editForm.startDate as string | undefined),
                endDate: dateFieldForApi(editForm.endDate as string | undefined),
                assignedEmployees: editForm.assignedEmployees,
                assignedEmployeePayouts: editForm.assignedEmployeePayouts,
                ...(assigneesJustAdded ? { status: 'under_development' as const } : {}),
            };
            const res = await api.patch<Project>(`/projects/${id}`, payload);
            if (res.success && res.data) {
                setProject({ ...project, ...res.data });
                setIsEditing(false);
            } else {
                setSystemPopup({
                    title: 'Could not save',
                    message: res.error?.message || 'Failed to save project details. Please try again.',
                });
            }
        } catch (err) {
            console.error('Failed to save', err);
            setSystemPopup({
                title: 'Could not save',
                message: 'Failed to save project details. Please try again.',
            });
        }
    };

    const toggleEmployee = (empId: string) => {
        if (!isEditing) return;
        const current = editForm.assignedEmployees || [];
        const payoutMap = { ...((editForm.assignedEmployeePayouts || {}) as Record<string, number>) };
        if (current.includes(empId)) {
            delete payoutMap[empId];
            setEditForm({
                ...editForm,
                assignedEmployees: current.filter(id => id !== empId),
                assignedEmployeePayouts: payoutMap,
            });
        } else {
            setEditForm({
                ...editForm,
                assignedEmployees: [...current, empId],
                assignedEmployeePayouts: payoutMap,
            });
        }
    };

    const handleGeneratePlan = async () => {
        if (!selectedTemplate) return alert('Please select a template');
        setGeneratingPlan(true);
        try {
            const res = await api.post<any>('/payment-plans/instantiate', {
                projectId: id,
                templateId: selectedTemplate,
                planStartDate: new Date().toISOString()
            });
            if (res.success) {
                alert('Payment Plan generated!');
                load();
            } else {
                alert('Error generating template: ' + JSON.stringify(res.error));
            }
        } catch (err) {
            alert('Failed to generate payment plan');
        } finally {
            setGeneratingPlan(false);
        }
    };

    const confirmDelete = async () => {
        if (!id) return;
        setDeleting(true);
        try {
            await api.delete(`/projects/${id}`);
            navigate('/projects');
        } catch (err) {
            console.error('Failed to delete', err);
            alert('Failed to delete project');
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const getReleaseLabel = (empId: string) => {
        const st = project?.assignedEmployeePayoutRelease?.[empId] ?? 'accruing';
        if (st === 'submitted') return 'Awaiting admin approval';
        if (st === 'released') return 'Paid to wallet';
        return 'In progress';
    };

    const submitPayoutCompletion = async () => {
        if (!id) return;
        setPayoutActionKey('submit-self');
        const res = await api.post<Project>(`/projects/${id}/payout-completion/submit`, {});
        setPayoutActionKey(null);
        if (res.success) {
            await load();
            setSystemPopup({
                title: 'Submitted for review',
                message:
                    'A notification was sent to the Admin for approval. Pending earnings stay visible until an owner approves and moves them to your wallet.',
            });
        } else {
            setSystemPopup({
                title: 'Could not submit',
                message: res.error?.message || 'Check that you are assigned, have a payout amount, and the project is under development.',
            });
        }
    };

    const approveDeveloperWallet = async (developerId: string) => {
        if (!id) return;
        setPayoutActionKey(`approve-${developerId}`);
        const res = await api.post<Project>(`/projects/${id}/payout-completion/approve`, { developerId });
        setPayoutActionKey(null);
        if (res.success) {
            await load();
            setSystemPopup({
                title: 'Payout approved',
                message: 'Pending earnings for this developer have been moved to their available wallet balance.',
            });
        } else {
            setSystemPopup({
                title: 'Could not approve',
                message: res.error?.message || 'The developer may not be awaiting approval.',
            });
        }
    };

    if (loading) return <div className={styles.container}>Loading...</div>;
    if (!project) return <div className={styles.container}>Project not found.</div>;
    const isAdmin = user?.role === 'owner';
    const canManagePayouts = user?.role === 'owner' || user?.role === 'pm';

    const downloadFinancialSheet = async () => {
        if (!id) return;
        setDownloadingFinancial(true);
        try {
            await api.download(`/reports/project-financial/${id}/download`, `project-financial.csv`);
        } catch (err) {
            pushSystemToast(err instanceof Error ? err.message : 'Download failed.', 'error');
        } finally {
            setDownloadingFinancial(false);
        }
    };
    const activeStatus = isProjectUnderDevelopment(String(isEditing ? editForm.status : project.status));
    const selectedEmployees = (isEditing ? editForm.assignedEmployees : project.assignedEmployees) || [];
    const payoutMap = ((isEditing ? editForm.assignedEmployeePayouts : project.assignedEmployeePayouts) || {}) as Record<string, number>;

    const totalDeveloperPayoutsDisplay = isEditing
        ? sumPayoutMap(payoutMap)
        : (project.totalDeveloperPayouts ?? sumPayoutMap(project.assignedEmployeePayouts));
    const expensesDisplay = Math.max(
        0,
        Number(
            isEditing ? (editForm.expenses ?? project.expenses ?? 0) : (project.expenses ?? 0)
        )
    );
    const totalValueDisplay = Number(
        isEditing ? (editForm.totalValue ?? project.totalValue) : project.totalValue
    );
    const netProfitDisplay =
        (Number.isFinite(totalValueDisplay) ? totalValueDisplay : 0) -
        totalDeveloperPayoutsDisplay -
        expensesDisplay;

    const primaryPlans = paymentPlans.filter((p) => (p.planKind ?? 'primary') === 'primary');

    return (
        <div className={styles.container}>
            <div className="flex flex-col gap-4 mb-6">
                <Link to="/projects" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors w-fit">
                    <ArrowLeft size={20} />
                    <span className="font-medium text-lg">Back</span>
                </Link>
                <div className={styles.breadcrumb}>
                    <span>Home</span> &gt; <span>Projects</span> &gt; <span className="font-semibold">Project Details</span>
                </div>
            </div>

            <div className={styles.tabRow}>
                <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className={`${styles.tabBtn} ${activeTab === 'details' ? styles.tabBtnActive : ''}`}
                >
                    Project Details
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('assignments')}
                    className={`${styles.tabBtn} ${activeTab === 'assignments' ? styles.tabBtnActive : ''}`}
                >
                    Assign Employees
                </button>
            </div>

            <div className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>{project.projectName}</h1>
                    <p className={styles.subTitle}>
                        {project.clientId ? (
                            <Link
                                to={`/customer/${project.clientId}`}
                                className="text-orange-600 hover:text-orange-700 font-semibold underline-offset-2 hover:underline cursor-pointer"
                            >
                                {project.clientName || 'Customer'}
                            </Link>
                        ) : (
                            <span>{project.clientName || 'Unknown client'}</span>
                        )}
                        {project.systemType ? (
                            <>
                                {' · '}
                                <span className="text-gray-600">{project.systemType}</span>
                            </>
                        ) : null}
                    </p>
                    {user?.role !== 'employee' && project.requirementWorkflowLabel === 'to_be_updated' && (
                        <Link
                            to={`/projects/${id}/requirement-workflow`}
                            className="mt-2 inline-flex text-sm font-semibold text-orange-600 hover:text-orange-700 underline-offset-2 hover:underline"
                        >
                            Open requirement workflow (assign developers)
                        </Link>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canManagePayouts ? (
                        <button
                            type="button"
                            disabled={downloadingFinancial}
                            onClick={() => void downloadFinancialSheet()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Download size={16} aria-hidden />
                            {downloadingFinancial ? 'Exporting…' : 'Financial sheet'}
                        </button>
                    ) : null}
                    <button onClick={() => setShowDeleteModal(true)} className={styles.deleteBtn}>
                        <Trash2 size={16} /> Delete Project
                    </button>
                </div>
            </div>

            <div className={styles.grid}>
                {/* Main Content: General Details */}
                <div className={styles.mainCard}>
                    <div className={styles.cardHeader}>
                        <div className="flex items-center gap-4">
                            <h2 className={styles.cardTitle}>
                                {activeTab === 'details' ? 'Project Details' : 'Assign Employees'}
                            </h2>
                            <div className="relative w-40">
                                <select
                                    value={normalizeProjectStatus(project.status)}
                                    onChange={(e) => updateStatus(e.target.value)}
                                    className={`appearance-none w-full pl-4 pr-10 py-2 rounded-full text-xs font-bold border uppercase tracking-wide cursor-pointer focus:outline-none transition-colors shadow-sm ${getStatusColor(project.status)}`}
                                >
                                    <option value="unassigned">Unassigned</option>
                                    <option value="under_development">Under development</option>
                                    <option value="completed">Completed</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={14} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <button onClick={handleSave} className={styles.saveBtn}>Save Project</button>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
                                    <Edit3 size={16} />{' '}
                                    {activeTab === 'assignments' ? 'Edit assignments & payouts' : 'Edit Details'}
                                </button>
                            )}
                        </div>
                    </div>

                    {activeTab === 'details' && (
                        <>
                            <div className={styles.formGroup}>
                                <label>Project Name</label>
                                <input
                                    value={isEditing ? editForm.projectName || '' : project.projectName}
                                    onChange={e => setEditForm({ ...editForm, projectName: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>System Type</label>
                                <input
                                    value={isEditing ? editForm.systemType || '' : project.systemType || ''}
                                    onChange={e => setEditForm({ ...editForm, systemType: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Total Value (Rs.)</label>
                                <input
                                    value={isEditing ? editForm.totalValue || '' : project.totalValue}
                                    onChange={e => setEditForm({ ...editForm, totalValue: Number(e.target.value) })}
                                    readOnly={!isEditing}
                                    type="number"
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                />
                            </div>

                            {isAdmin && (
                                <div className={styles.formGroup}>
                                    <label>Other expenses (Rs.)</label>
                                    <p className="text-xs text-gray-500 mb-1">
                                        Non-developer costs for this deal (tools, vendors, etc.). Used in net profit.
                                    </p>
                                    <input
                                        value={
                                            isEditing
                                                ? editForm.expenses === undefined
                                                    ? ''
                                                    : String(editForm.expenses)
                                                : String(project.expenses ?? 0)
                                        }
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            setEditForm({
                                                ...editForm,
                                                expenses: raw === '' ? undefined : Math.max(0, Number(raw)),
                                            });
                                        }}
                                        readOnly={!isEditing}
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        className={isEditing ? styles.inputParam : styles.inputReadonly}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className={styles.formGroup}>
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        value={isEditing ? editForm.startDate || '' : project.startDate ? project.startDate.slice(0, 10) : ''}
                                        onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
                                        readOnly={!isEditing}
                                        className={isEditing ? styles.inputParam : styles.inputReadonly}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        value={isEditing ? editForm.endDate || '' : project.endDate ? project.endDate.slice(0, 10) : ''}
                                        onChange={e => setEditForm({ ...editForm, endDate: e.target.value })}
                                        readOnly={!isEditing}
                                        className={isEditing ? styles.inputParam : styles.inputReadonly}
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Description</label>
                                <textarea
                                    value={isEditing ? editForm.description || '' : project.description || ''}
                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    readOnly={!isEditing}
                                    className={isEditing ? styles.inputParam : styles.inputReadonly}
                                    rows={4}
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'assignments' && (
                        <>
                            <div className={styles.formGroup}>
                                <label>Assign Employees</label>
                                <div className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl overflow-y-auto max-h-48">
                                    {users.length === 0 ? <p className="text-gray-500 text-sm">No employees found.</p> : users.map(u => {
                                        const isAssigned = isEditing
                                            ? (editForm.assignedEmployees || []).includes(u._id)
                                            : (project.assignedEmployees || []).includes(u._id);
                                        return (
                                            <div
                                                key={u._id}
                                                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${!isEditing ? 'opacity-80 cursor-default' : 'cursor-pointer hover:bg-gray-100'} ${isAssigned ? 'bg-orange-50 bg-opacity-50' : ''}`}
                                                onClick={() => toggleEmployee(u._id)}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${isAssigned ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 bg-white'}`}>
                                                    {isAssigned && <CheckSquare size={14} />}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-800">{u.name}</div>
                                                    <div className="text-xs text-gray-500">{u.email}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {canManagePayouts && activeStatus && selectedEmployees.length > 0 && (
                                <div className={styles.formGroup}>
                                    <label>Payout Value (per assigned developer)</label>
                                    <div className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                        {selectedEmployees.map((empId) => {
                                            const employee = users.find((u) => u._id === empId);
                                            return (
                                                <div key={empId} className="grid grid-cols-[1fr_180px] gap-3 items-center">
                                                    <div className="text-sm font-medium text-gray-700">
                                                        {employee?.name || 'Assigned developer'}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="0.01"
                                                        placeholder="Enter payout"
                                                        readOnly={!isEditing}
                                                        value={payoutMap[empId] ?? ''}
                                                        onChange={(e) => {
                                                            const next = { ...payoutMap };
                                                            const raw = e.target.value;
                                                            if (!raw) {
                                                                delete next[empId];
                                                            } else {
                                                                next[empId] = Number(raw);
                                                            }
                                                            setEditForm({ ...editForm, assignedEmployeePayouts: next });
                                                        }}
                                                        className={isEditing ? styles.inputParam : styles.inputReadonly}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'assignments' && isProjectUnderDevelopment(project.status) && !isEditing && (
                                <div className={styles.formGroup}>
                                    <label>Task completion &amp; wallet</label>
                                    <p className="text-xs text-gray-500 mb-2">
                                        Once clicked, a notification is sent to Admin for approval; an owner then moves pending payout into the developer&apos;s available wallet balance.
                                    </p>
                                    <div className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                        {(project.assignedEmployees || []).filter((empId) => Number(project.assignedEmployeePayouts?.[empId] || 0) > 0).length === 0 ? (
                                            <p className="text-sm text-gray-500">No payout amounts set for assignees yet.</p>
                                        ) : (
                                            (project.assignedEmployees || [])
                                                .filter((empId) => Number(project.assignedEmployeePayouts?.[empId] || 0) > 0)
                                                .map((empId) => {
                                                    const employee = users.find((u) => u._id === empId);
                                                    const amt = Number(project.assignedEmployeePayouts?.[empId] || 0);
                                                    const release = project.assignedEmployeePayoutRelease?.[empId] ?? 'accruing';
                                                    const isSelf = user?._id === empId;
                                                    const busy = payoutActionKey === 'submit-self' || payoutActionKey === `approve-${empId}`;
                                                    return (
                                                        <div key={empId} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-800">{employee?.name || 'Developer'}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    Rs. {amt.toLocaleString()} · {getReleaseLabel(empId)}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                {user?.role === 'employee' && isSelf && release === 'accruing' && (
                                                                    <button
                                                                        type="button"
                                                                        disabled={!!payoutActionKey}
                                                                        onClick={submitPayoutCompletion}
                                                                        title="Once clicked, a notification is sent to Admin for approval."
                                                                        aria-label="Mark task completed. Once clicked, a notification is sent to Admin for approval."
                                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white disabled:opacity-50"
                                                                    >
                                                                        {busy && payoutActionKey === 'submit-self' ? 'Submitting…' : 'Mark task completed'}
                                                                    </button>
                                                                )}
                                                                {user?.role === 'owner' && release === 'submitted' && (
                                                                    <button
                                                                        type="button"
                                                                        disabled={!!payoutActionKey}
                                                                        onClick={() => approveDeveloperWallet(empId)}
                                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-600 bg-green-50 text-green-800 disabled:opacity-50"
                                                                    >
                                                                        {busy && payoutActionKey === `approve-${empId}` ? 'Approving…' : 'Approve — move to wallet'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Sidebar: Payment Plans & Installments */}
                <div className={styles.sidebar}>

                    {isAdmin && (
                        <div className={styles.sideCard}>
                            <div className={styles.sideHeader}>
                                <DollarSign size={18} className="text-orange-500" />
                                <h3>Deal economics</h3>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                                Net profit = total project value − (all developer payouts + expenses).
                            </p>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between gap-2">
                                    <dt className="text-gray-600">Total project value</dt>
                                    <dd className="font-medium text-gray-900">
                                        Rs. {totalValueDisplay.toLocaleString()}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <dt className="text-gray-600">Total developer payouts</dt>
                                    <dd className="font-medium text-gray-900">
                                        Rs. {totalDeveloperPayoutsDisplay.toLocaleString()}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <dt className="text-gray-600">Expenses</dt>
                                    <dd className="font-medium text-gray-900">
                                        Rs. {expensesDisplay.toLocaleString()}
                                    </dd>
                                </div>
                                <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
                                    <dt className="font-semibold text-gray-800">Net profit</dt>
                                    <dd
                                        className={`font-bold ${
                                            netProfitDisplay >= 0 ? 'text-green-700' : 'text-red-700'
                                        }`}
                                    >
                                        Rs. {netProfitDisplay.toLocaleString()}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    )}

                    {/* Main contract — payment plans (proposal / primary deal) */}
                    <div className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <List size={18} className="text-orange-500" />
                            <h3>Main contract — payment plans</h3>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-2 leading-snug">
                            Contract total (project value): Rs. {totalValueDisplay.toLocaleString()}. Add-on features use the card below.
                        </p>

                        <div className={styles.listContainer}>
                            {primaryPlans.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="bg-orange-100 p-3 rounded-full mb-3">
                                        <List size={24} className="text-orange-500" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No main payment plan yet</p>
                                </div>
                            ) : (
                                primaryPlans.map((plan) => (
                                    <div key={plan._id} className={styles.listItem}>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-medium text-gray-800 text-sm truncate">Main plan · #{plan._id.slice(-4)}</div>
                                            <div className="text-xs text-gray-500">
                                                Down: Rs. {Number(plan.downPaymentAmt || 0).toLocaleString()}
                                                {plan.totalInstallments != null ? ` · ${plan.totalInstallments} inst.` : ''}
                                            </div>
                                        </div>
                                        <span
                                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                                            }`}
                                        >
                                            {plan.status}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {primaryPlans.length === 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Generate from Template</label>
                                <select 
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                                    value={selectedTemplate}
                                    onChange={e => setSelectedTemplate(e.target.value)}
                                >
                                    <option value="">-- Select Template --</option>
                                    {templates.map(t => (
                                        <option key={t._id} value={t._id}>{t.name} ({t.templateType})</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleGeneratePlan}
                                    disabled={generatingPlan || !selectedTemplate}
                                    className={`${styles.orangeBtn} ${(!selectedTemplate || generatingPlan) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {generatingPlan ? 'Generating...' : 'Generate Plan'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Main contract installments */}
                    <div className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <DollarSign size={18} className="text-orange-500" />
                            <h3>Main contract — installments</h3>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-2">From the primary payment plan (first active plan).</p>

                        <div className={styles.listContainer}>
                            {mainInstallments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="bg-orange-100 p-3 rounded-full mb-3">
                                        <DollarSign size={24} className="text-orange-500" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No Installments Scheduled</p>
                                </div>
                            ) : (
                                mainInstallments.slice(0, 4).map(inst => (
                                    <div key={inst._id} className={styles.listItem}>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-medium text-gray-800 text-sm truncate">Inst. #{inst.installmentNo}</div>
                                            <div className="text-xs text-gray-500">
                                                {inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('en-GB') : 'No Date'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-gray-900 text-sm">Rs. {Number(inst.dueAmount || 0).toLocaleString()}</div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${inst.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {inst.status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => navigate(`/installments?projectId=${project._id}`)}
                            className={styles.orangeBtn}
                            style={{ background: '#4b5563', color: 'white' }}
                        >
                            View All Cash Flow
                        </button>
                    </div>

                    {/* Value-added requirements — separate payment plans & installments */}
                    <div className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <List size={18} className="text-amber-700" />
                            <h3>Value-added requirements</h3>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-2 leading-snug">
                            Separate from the main proposal total. Created from requirement workflow when you add a billable feature.
                        </p>
                        {addonPlanInstallments.length === 0 ? (
                            <div className="flex flex-col gap-2 py-2">
                                <p className="text-gray-500 text-sm">No add-on payment plans for this project yet.</p>
                                {user?.role !== 'employee' && (
                                    <Link
                                        to={`/projects/${id}/requirement-workflow`}
                                        className="text-sm font-semibold text-orange-600 hover:text-orange-700 underline-offset-2 hover:underline"
                                    >
                                        Open requirement workflow
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {addonPlanInstallments.map(({ plan, installments: addInst }) => {
                                    const totalAddon =
                                        Number(plan.downPaymentAmt || 0) +
                                        Number(plan.installmentAmt || 0) * Number(plan.totalInstallments || 0);
                                    return (
                                        <div key={plan._id} className="border border-amber-200 rounded-lg p-3 bg-amber-50/50">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <div>
                                                    <div className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                                                        Add-on plan · #{plan._id.slice(-4)}
                                                    </div>
                                                    <div className="text-[11px] text-gray-600 mt-0.5">
                                                        Req. {plan.linkedRequirementId ? plan.linkedRequirementId.slice(-6) : '—'} · approx. total Rs.{' '}
                                                        {Number.isFinite(totalAddon) ? totalAddon.toLocaleString() : '—'}
                                                    </div>
                                                </div>
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                                                        plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                                                    }`}
                                                >
                                                    {plan.status}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-700 mb-2">
                                                Down Rs. {Number(plan.downPaymentAmt || 0).toLocaleString()} ·{' '}
                                                {Number(plan.totalInstallments || 0)} × Rs.{' '}
                                                {Number(plan.installmentAmt || 0).toLocaleString()}
                                            </div>
                                            {addInst.length === 0 ? (
                                                <p className="text-xs text-gray-500">No installment rows yet.</p>
                                            ) : (
                                                <ul className="space-y-1.5 border-t border-amber-100 pt-2">
                                                    {addInst.slice(0, 4).map((inst) => (
                                                        <li key={inst._id} className="flex justify-between text-xs text-gray-800">
                                                            <span>
                                                                #{inst.installmentNo}{' '}
                                                                {inst.dueDate
                                                                    ? new Date(inst.dueDate).toLocaleDateString('en-GB')
                                                                    : ''}
                                                            </span>
                                                            <span className="font-medium">
                                                                Rs. {Number(inst.dueAmount || 0).toLocaleString()}{' '}
                                                                <span className="text-[10px] text-gray-500">({inst.status})</span>
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => navigate(`/installments?projectId=${project._id}`)}
                                    className={styles.orangeBtn}
                                    style={{ background: '#b45309', color: 'white' }}
                                >
                                    All installments (main + add-ons)
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            <ConfirmDialog
                open={showDeleteModal}
                title="Delete Project"
                message="Are you sure you want to delete this project? This action cannot be undone."
                confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteModal(false)}
                danger
            />
            <ConfirmDialog
                open={!!systemPopup}
                title={systemPopup?.title ?? ''}
                message={systemPopup?.message ?? ''}
                confirmLabel="OK"
                alertMode
                danger={false}
                onConfirm={() => setSystemPopup(null)}
                onCancel={() => setSystemPopup(null)}
            />
        </div>
    );
}
