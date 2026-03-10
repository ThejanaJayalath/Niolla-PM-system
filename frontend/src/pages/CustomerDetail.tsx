import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Edit3,
    Trash2,
    FolderKanban,
    FileText,
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
    const [loading, setLoading] = useState(true);

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

            <div className={styles.grid}>
                {/* Main Content: General Details */}
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

                {/* Sidebar: Projects & Financials */}
                <div className={styles.sidebar}>

                    {/* Projects Zone */}
                    <div className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <FolderKanban size={18} className="text-orange-500" />
                            <h3>Projects</h3>
                        </div>

                        <div className={styles.listContainer}>
                            {projects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="bg-orange-100 p-3 rounded-full mb-3">
                                        <FolderKanban size={24} className="text-orange-500" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No Projects Linked</p>
                                </div>
                            ) : (
                                projects.map(p => (
                                    <div key={p._id} className={styles.listItem} onClick={() => navigate('/projects')} style={{ cursor: 'pointer' }}>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-medium text-gray-800 text-sm truncate">{p.projectName}</div>
                                            <div className="text-xs text-gray-500">Rs. {Number(p.totalValue || 0).toLocaleString()}</div>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                                            {p.status}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => navigate(`/projects?newProjectForCustomer=${customer._id}`)}
                            className={styles.orangeBtn}
                        >
                            Start New Project
                        </button>
                    </div>

                    {/* Financials Zone */}
                    <div className={styles.sideCard}>
                        <div className={styles.sideHeader}>
                            <FileText size={18} className="text-orange-500" />
                            <h3>Financials</h3>
                        </div>

                        <div className={styles.listContainer}>
                            {invoices.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <div className="bg-orange-100 p-3 rounded-full mb-3">
                                        <FileText size={24} className="text-orange-500" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No Financial Records</p>
                                </div>
                            ) : (
                                invoices.map(inv => (
                                    <div key={inv._id} className={styles.listItem} onClick={() => navigate('/invoices')} style={{ cursor: 'pointer' }}>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-medium text-gray-800 text-sm truncate">{inv.invoiceNumber}</div>
                                            <div className="text-xs text-gray-500">Rs. {Number(inv.totalAmount || 0).toLocaleString()}</div>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {inv.status}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => navigate('/invoices')}
                            className={styles.orangeBtn}
                            style={{ background: '#4b5563', color: 'white' }}
                        >
                            View Statement
                        </button>
                    </div>

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
