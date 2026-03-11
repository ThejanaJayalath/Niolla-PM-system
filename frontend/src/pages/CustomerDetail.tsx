import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Edit3,
    Trash2,
    FolderKanban,
} from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
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

export default function CustomerDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [overdueInstallments, setOverdueInstallments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'details' | 'projects' | 'payments'>('details');
    // Collapsible states for payments
    const [expandedPaymentSection, setExpandedPaymentSection] = useState<'plans' | 'history' | 'overdue' | 'invoices'>('plans');

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
                    </div>

                    {activeTab === 'details' && (
                        <div className={styles.mainCard}>
                            <div className={styles.cardHeader}>
                                <h2 className={styles.cardTitle}>Customer Details</h2>
                                <div className="flex items-center gap-2">
                                    {isEditing ? (
                                        <button onClick={handleSave} className={styles.saveBtn}>Save Customer</button>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
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
        </div>
    );
}
