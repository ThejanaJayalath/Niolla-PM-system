import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ChevronDown,
    Edit3,
    Trash2,
    List,
    DollarSign,
    CheckSquare
} from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './ProjectDetail.module.css';

interface Project {
    _id: string;
    clientId: string;
    clientName?: string;
    projectName: string;
    description?: string;
    systemType?: string;
    totalValue: number;
    startDate?: string;
    endDate?: string;
    assignedEmployees?: string[];
    status: 'active' | 'completed' | 'cancelled';
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
}

interface Installment {
    _id: string;
    installmentNo: number;
    dueDate: string;
    dueAmount: number;
    status: string;
}


const getStatusColor = (status: string) => {
    if (status === 'active') return 'bg-[#dcfce7] text-green-600 border-transparent';
    if (status === 'completed') return 'bg-[#dbeafe] text-blue-600 border-transparent';
    if (status === 'cancelled') return 'bg-[#fee2e2] text-red-600 border-transparent';
    return 'bg-white text-gray-700 border-gray-200';
};

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | null>(null);
    const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [templates, setTemplates] = useState<PaymentPlanTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Project>>({});
    
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [generatingPlan, setGeneratingPlan] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

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
                    startDate: projRes.data.startDate ? projRes.data.startDate.slice(0, 10) : '',
                    endDate: projRes.data.endDate ? projRes.data.endDate.slice(0, 10) : '',
                    status: projRes.data.status,
                    assignedEmployees: projRes.data.assignedEmployees || [],
                });
            }

            if (usersRes.success && usersRes.data) setUsers(usersRes.data);
            if (tplRes.success && tplRes.data) setTemplates(tplRes.data);

            if (planRes.success && planRes.data) {
                setPaymentPlans(planRes.data);
                if (planRes.data.length > 0) {
                    const activePlan = planRes.data.find(p => p.status !== 'cancelled') || planRes.data[0];
                    const instRes = await api.get<Installment[]>(`/installments?paymentPlanId=${activePlan._id}`);
                    if (instRes.success && instRes.data) {
                        setInstallments(instRes.data);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    const updateStatus = async (status: string) => {
        if (!id || !project) return;
        setProject({ ...project, status: status as Project['status'] });
        const res = await api.patch<Project>(`/projects/${id}`, { status });
        if (!res.success) load();
    };

    const handleSave = async () => {
        if (!id) return;
        try {
            const payload = {
                projectName: editForm.projectName,
                description: editForm.description,
                systemType: editForm.systemType,
                totalValue: editForm.totalValue ? Number(editForm.totalValue) : undefined,
                startDate: editForm.startDate,
                endDate: editForm.endDate,
                assignedEmployees: editForm.assignedEmployees,
            };
            const res = await api.patch<Project>(`/projects/${id}`, payload);
            if (res.success && res.data) {
                setProject({ ...project, ...res.data });
                setIsEditing(false);
            }
        } catch (err) {
            console.error('Failed to save', err);
            alert('Failed to save project details');
        }
    };

    const toggleEmployee = (empId: string) => {
        if (!isEditing) return;
        const current = editForm.assignedEmployees || [];
        if (current.includes(empId)) {
            setEditForm({ ...editForm, assignedEmployees: current.filter(id => id !== empId) });
        } else {
            setEditForm({ ...editForm, assignedEmployees: [...current, empId] });
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

    if (loading) return <div className={styles.container}>Loading...</div>;
    if (!project) return <div className={styles.container}>Project not found.</div>;

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

            <div className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>{project.projectName}</h1>
                    <p className={styles.subTitle}>{project.clientName || 'Unknown Client'} • {project.systemType}</p>
                </div>
                <button onClick={() => setShowDeleteModal(true)} className={styles.deleteBtn}>
                    <Trash2 size={16} /> Delete Project
                </button>
            </div>

            <div className={styles.grid}>
                {/* Main Content: General Details */}
                <div className={styles.mainCard}>
                    <div className={styles.cardHeader}>
                        <div className="flex items-center gap-4">
                            <h2 className={styles.cardTitle}>Project Details</h2>
                            <div className="relative w-40">
                                <select
                                    value={project.status}
                                    onChange={(e) => updateStatus(e.target.value)}
                                    className={`appearance-none w-full pl-4 pr-10 py-2 rounded-full text-xs font-bold border uppercase tracking-wide cursor-pointer focus:outline-none transition-colors shadow-sm ${getStatusColor(project.status)}`}
                                >
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={14} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <button onClick={handleSave} className={styles.saveBtn}>Save Project</button>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
                                    <Edit3 size={16} /> Edit Details
                                </button>
                            )}
                        </div>
                    </div>

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
                </div>

                {/* Sidebar: Payment Plans & Installments */}
                <div className={styles.sidebar}>

                    {/* Payment Plans Zone */}
                    <div className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <List size={18} className="text-orange-500" />
                            <h3>Payment Plans</h3>
                        </div>

                        <div className={styles.listContainer}>
                            {paymentPlans.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="bg-orange-100 p-3 rounded-full mb-3">
                                        <List size={24} className="text-orange-500" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No Active Payment Plan</p>
                                </div>
                            ) : (
                                paymentPlans.map(plan => (
                                    <div key={plan._id} className={styles.listItem}>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-medium text-gray-800 text-sm truncate">Plan #{plan._id.slice(-4)}</div>
                                            <div className="text-xs text-gray-500">Down Pay: Rs. {Number(plan.downPaymentAmt || 0).toLocaleString()}</div>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                                            {plan.status}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {paymentPlans.length === 0 && (
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

                    {/* Cash Flow Pipeline Zone */}
                    <div className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <DollarSign size={18} className="text-orange-500" />
                            <h3>Upcoming Installments</h3>
                        </div>

                        <div className={styles.listContainer}>
                            {installments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="bg-orange-100 p-3 rounded-full mb-3">
                                        <DollarSign size={24} className="text-orange-500" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No Installments Scheduled</p>
                                </div>
                            ) : (
                                installments.slice(0, 4).map(inst => (
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
        </div>
    );
}
