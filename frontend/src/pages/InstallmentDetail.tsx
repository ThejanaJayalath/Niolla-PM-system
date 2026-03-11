import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, Clock, DollarSign, Calendar, ChevronRight, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import RecordPaymentModal from '../components/RecordPaymentModal';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './CustomerDetail.module.css';

interface PaymentPlan {
    _id: string;
    projectId?: string;
    projectName?: string;
    clientName?: string;
    downPaymentPct: number;
    downPaymentAmt: number;
    totalInstallments: number;
    installmentAmt: number;
    remainingBalance: number;
    planStartDate?: string;
    status: 'active' | 'completed' | 'cancelled';
}

interface Installment {
    _id: string;
    planId: string;
    installmentNo: number;
    dueDate: string;
    dueAmount: number;
    paidAmount: number;
    paidDate?: string;
    status: 'pending' | 'paid' | 'partial' | 'overdue';
    overdueDays: number;
    projectName?: string;
}

export default function InstallmentDetail() {
    const { planId } = useParams<{ planId: string }>();

    const [plan, setPlan] = useState<PaymentPlan | null>(null);
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [loading, setLoading] = useState(true);


    const [payModalOpen, setPayModalOpen] = useState(false);
    const [payInstId, setPayInstId] = useState<string | undefined>(undefined);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = async () => {
        if (!planId) return;
        try {
            const [planRes, instRes] = await Promise.all([
                api.get<PaymentPlan>(`/payment-plans/${planId}`),
                api.get<Installment[]>(`/installments?planId=${planId}`),
            ]);
            if (planRes.success && planRes.data) setPlan(planRes.data);
            if (instRes.success && instRes.data) setInstallments(instRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [planId]);

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            const res = await api.delete(`/installments/${deleteId}`);
            if (res?.success === false) {
                alert(res.error?.message || 'Failed to delete installment');
            } else {
                await load();
                setDeleteId(null);
            }
        } catch (err) {
            console.error(err);
            alert('An unexpected error occurred while deleting');
        } finally {
            setDeleting(false);
        }
    };

    const fmtDate = (d?: string) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    const statusMeta = (status: string) => {
        switch (status) {
            case 'paid':    return { cls: 'bg-green-100 text-green-800',  Icon: CheckCircle,     label: 'Paid' };
            case 'partial': return { cls: 'bg-amber-100 text-amber-800',  Icon: Clock,           label: 'Partial' };
            case 'overdue': return { cls: 'bg-red-100 text-red-800',      Icon: AlertTriangle,   label: 'Overdue' };
            default:        return { cls: 'bg-gray-100 text-gray-700',    Icon: Clock,           label: 'Pending' };
        }
    };

    // Summary stats
    const totalPaid = installments.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
    const totalDue  = installments.reduce((s, i) => s + Number(i.dueAmount || 0), 0);
    const paidCount = installments.filter(i => i.status === 'paid').length;
    const overdueCount = installments.filter(i => i.status === 'overdue').length;

    if (loading) return <div className={styles.container} style={{ paddingTop: '3rem', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    if (!plan) return <div className={styles.container}>Payment plan not found.</div>;

    return (
        <div className={styles.container}>
            {/* Breadcrumb */}
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                <Link to="/installments" className="hover:text-orange-500 transition-colors flex items-center gap-1">
                    <ArrowLeft size={14} /> Installments
                </Link>
                <ChevronRight size={14} />
                <span className="text-gray-700 font-medium">
                    Plan #{planId?.slice(-6)}
                    {plan.projectName && ` — ${plan.projectName}`}
                </span>
            </div>

            {/* Page header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.pageTitle}>Installment Schedule</h1>
                    {plan.clientName && <p className="text-gray-500 mt-1 text-sm">Customer: <span className="font-medium text-gray-700">{plan.clientName}</span></p>}
                    {plan.projectName && <p className="text-gray-500 text-sm">Project: <span className="font-medium text-gray-700">{plan.projectName}</span></p>}
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide ${plan.status === 'active' ? 'bg-green-100 text-green-700' : plan.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                    {plan.status}
                </span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                        <DollarSign size={14} /> Total Value
                    </div>
                    <div className="text-2xl font-bold text-gray-900">Rs. {Number(totalDue).toLocaleString()}</div>
                </div>
                <div className="bg-white border border-green-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                        <CheckCircle size={14} /> Collected
                    </div>
                    <div className="text-2xl font-bold text-green-700">Rs. {Number(totalPaid).toLocaleString()}</div>
                </div>
                <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                        <DollarSign size={14} /> Balance
                    </div>
                    <div className="text-2xl font-bold text-orange-600">Rs. {Number(plan.remainingBalance || 0).toLocaleString()}</div>
                </div>
                <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                        <Calendar size={14} /> Progress
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{paidCount} / {plan.totalInstallments}</div>
                    {overdueCount > 0 && <div className="text-xs text-red-600 mt-1 font-semibold">{overdueCount} overdue</div>}
                </div>
            </div>

            {/* Plan meta strip */}
            <div className="bg-white border border-orange-100 rounded-2xl px-6 py-4 shadow-sm mb-6 flex flex-wrap gap-6 text-sm text-gray-600">
                <div><span className="text-gray-400 font-medium mr-1">Down Payment:</span> {plan.downPaymentPct}% — Rs. {Number(plan.downPaymentAmt || 0).toLocaleString()}</div>
                <div><span className="text-gray-400 font-medium mr-1">Installment Amt:</span> Rs. {Number(plan.installmentAmt || 0).toLocaleString()}</div>
                <div><span className="text-gray-400 font-medium mr-1">Start Date:</span> {fmtDate(plan.planStartDate)}</div>
                <div><span className="text-gray-400 font-medium mr-1">Total Installments:</span> {plan.totalInstallments}</div>
            </div>

            {/* Installments table */}
            <div className="bg-white border border-orange-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-orange-50">
                    <h2 className="font-bold text-gray-800 text-base">All Installments</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-orange-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-orange-500 font-bold text-xs uppercase tracking-wide">#</th>
                                <th className="px-6 py-3 text-left text-orange-500 font-bold text-xs uppercase tracking-wide">Due Date</th>
                                <th className="px-6 py-3 text-right text-orange-500 font-bold text-xs uppercase tracking-wide">Due Amount</th>
                                <th className="px-6 py-3 text-right text-orange-500 font-bold text-xs uppercase tracking-wide">Paid</th>
                                <th className="px-6 py-3 text-right text-orange-500 font-bold text-xs uppercase tracking-wide">Remaining</th>
                                <th className="px-6 py-3 text-left text-orange-500 font-bold text-xs uppercase tracking-wide">Paid Date</th>
                                <th className="px-6 py-3 text-left text-orange-500 font-bold text-xs uppercase tracking-wide">Status</th>
                                <th className="px-6 py-3 text-center text-orange-500 font-bold text-xs uppercase tracking-wide">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {installments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">No installments found for this plan.</td>
                                </tr>
                            ) : installments.map((inst) => {
                                const remaining = Number(inst.dueAmount) - Number(inst.paidAmount || 0);
                                const { cls, Icon, label } = statusMeta(inst.status);
                                const isCurrentRow = inst.status === 'pending' || inst.status === 'partial' || inst.status === 'overdue';
                                return (
                                    <tr key={inst._id} className={`transition-colors hover:bg-orange-50 ${inst.status === 'overdue' ? 'bg-red-50' : inst.status === 'paid' ? 'bg-green-50/30' : ''}`}>
                                        <td className="px-6 py-4 font-bold text-gray-800">{inst.installmentNo}</td>
                                        <td className={`px-6 py-4 ${inst.status === 'overdue' ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                                            {fmtDate(inst.dueDate)}
                                            {inst.status === 'overdue' && inst.overdueDays > 0 && (
                                                <div className="text-xs text-red-500">{inst.overdueDays} days overdue</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">Rs. {Number(inst.dueAmount).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right text-green-700 font-medium">Rs. {Number(inst.paidAmount || 0).toLocaleString()}</td>
                                        <td className={`px-6 py-4 text-right font-bold ${remaining > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                            {remaining > 0 ? `Rs. ${remaining.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">{fmtDate(inst.paidDate)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
                                                <Icon size={11} />
                                                {label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center items-center gap-2">
                                                {isCurrentRow ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setPayInstId(inst._id); setPayModalOpen(true); }}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                                    >
                                                        <DollarSign size={12} /> Pay
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setDeleteId(inst._id); }}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Delete Installment"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <RecordPaymentModal
                open={payModalOpen}
                onClose={() => setPayModalOpen(false)}
                onSuccess={() => { setPayModalOpen(false); load(); }}
                installments={installments.map(i => ({
                    _id: i._id,
                    planId: i.planId,
                    projectName: plan.projectName,
                    installmentNo: i.installmentNo,
                    dueDate: i.dueDate,
                    dueAmount: i.dueAmount,
                    paidAmount: i.paidAmount,
                    status: i.status,
                }))}
                initialInstallmentId={payInstId}
            />

            <ConfirmDialog
                open={!!deleteId}
                title="Delete Installment"
                message="Are you sure you want to delete this installment? This might affect the payment plan balance."
                confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                cancelLabel="Cancel"
                danger
                onConfirm={handleDelete}
                onCancel={() => !deleting && setDeleteId(null)}
                isLoading={deleting}
            />
        </div>
    );
}
