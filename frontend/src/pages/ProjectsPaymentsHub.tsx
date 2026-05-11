import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import styles from './Inquiries.module.css';

interface CustomerRow {
    _id: string;
    customerId: string;
    name: string;
    phoneNumber: string;
    email?: string;
    companyName?: string;
    projects?: string[];
    status?: 'active' | 'inactive';
}

/**
 * Entry from sidebar: pick a customer, then continue on their profile
 * (Projects & payments tab — project list → drill-down).
 */
export default function ProjectsPaymentsHub() {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<CustomerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const t = setTimeout(() => {
            void (async () => {
                setLoading(true);
                try {
                    const params = new URLSearchParams();
                    if (search.trim()) params.append('search', search.trim());
                    const q = params.toString() ? `?${params.toString()}` : '';
                    const res = await api.get<CustomerRow[]>(`/customers${q}`);
                    if (res.success && res.data) setCustomers(res.data);
                    else setCustomers([]);
                } catch (e) {
                    console.error(e);
                    setCustomers([]);
                } finally {
                    setLoading(false);
                }
            })();
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const openFlow = (customerId: string) => {
        navigate(`/customer/${customerId}?view=projects-payments`);
    };

    return (
        <div className={`${styles.page} font-sans`}>
            <div className="mb-6">
                <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 mb-4"
                >
                    <ArrowLeft size={18} />
                    Dashboard
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Projects & payments</h1>
                <p className="text-sm text-gray-600 mt-2 max-w-2xl">
                    Step 1: choose a customer. Step 2: you&apos;ll open their profile on{' '}
                    <strong>Projects & payments</strong> — pick a project to see main contract vs add-ons, installments,
                    and paid transactions.
                </p>
            </div>

            <div className={styles.filtersRow}>
                <div className={styles.customerSearchWrap} style={{ maxWidth: 420 }}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name, phone, email, ID, company"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className="px-6 py-4 text-orange-500 font-bold text-sm">Customer ID</th>
                            <th className="px-6 py-4 text-orange-500 font-bold text-sm">Name</th>
                            <th className="px-6 py-4 text-orange-500 font-bold text-sm">Phone</th>
                            <th className="px-6 py-4 text-orange-500 font-bold text-sm">Company</th>
                            <th className="px-6 py-4 text-orange-500 font-bold text-sm text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    Loading…
                                </td>
                            </tr>
                        ) : customers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    No customers match your search.
                                </td>
                            </tr>
                        ) : (
                            customers.map((c) => (
                                <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{c.customerId}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{c.phoneNumber}</td>
                                    <td className="px-6 py-4 text-gray-600 truncate max-w-xs" title={c.companyName || ''}>
                                        {c.companyName || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            type="button"
                                            onClick={() => openFlow(c._id)}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors"
                                        >
                                            Continue
                                            <ChevronRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
