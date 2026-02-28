import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import AddCustomerModal from '../components/AddCustomerModal';
import styles from './Inquiries.module.css';

interface Customer {
  _id: string;
  customerId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  projects: string[];
}

export default function Customer() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<Customer[]>(`/customers${queryString}`);
      if (res.success && res.data) setCustomers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      load();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAdd = () => {
    setEditCustomer(null);
    setShowModal(true);
  };

  const handleEdit = (c: Customer) => {
    setEditCustomer(c);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditCustomer(null);
    load();
  };

  const handleDelete = async () => {
    const id = deleteId;
    if (!id) return;
    setDeleting(true);
    setDeleteId(null);
    try {
      const res = await api.delete(`/customers/${id}`);
      if (res?.success !== false) await load();
    } finally {
      setDeleting(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;
  const totalPages = Math.ceil(customers.length / rowsPerPage);
  const paginated = customers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Customer</h1>
        <button
          onClick={handleAdd}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      <div className={styles.filtersRow}>
        <div className="relative w-64 md:w-64 sm:w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by Name, Phone, Email, ID"
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
              <th className="px-6 py-4 w-[14%] text-orange-500 font-bold text-sm">Customer ID</th>
              <th className="px-6 py-4 w-[18%] text-orange-500 font-bold text-sm">Name</th>
              <th className="px-6 py-4 w-[16%] text-orange-500 font-bold text-sm">Phone Number</th>
              <th className="px-6 py-4 w-[20%] text-orange-500 font-bold text-sm">Email</th>
              <th className="px-6 py-4 w-[22%] text-orange-500 font-bold text-sm">Projects</th>
              <th className="px-6 py-4 w-[10%] text-orange-500 font-bold text-sm !text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : (
              <>
                {paginated.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">{c.customerId}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                    <td className="px-6 py-4 text-gray-600">{c.phoneNumber}</td>
                    <td className="px-6 py-4 text-gray-600">{c.email || '—'}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-xs" title={(c.projects || []).join(', ')}>
                      {(c.projects && c.projects.length) ? c.projects.join(', ') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(c)}
                          className="p-2 text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(c._id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, rowsPerPage - paginated.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="h-[60px]">
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>

        <div className="px-6 py-3 bg-[#f9fafb] border-t border-[#fed7aa] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows Per Page:</span>
            <span className="sm:hidden">Rows:</span>
            <span>{rowsPerPage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              {customers.length === 0 ? '0-0 of 0' : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, customers.length)} of ${customers.length}`}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddCustomerModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditCustomer(null); }}
        onSuccess={handleCloseModal}
        editCustomer={editCustomer}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Customer"
        message="Are you sure you want to delete this customer?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
