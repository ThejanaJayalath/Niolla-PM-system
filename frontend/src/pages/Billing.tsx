import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, DownloadCloud, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './Inquiries.module.css';
import { api } from '../api/client';

interface BillingRecord {
  _id: string;
  customerName: string;
  projectName?: string;
  billingId?: string;
  totalAmount: number;
  createdAt: string;
  phoneNumber?: string;
}

export default function Billing() {
  const navigate = useNavigate();
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const res = await api.get<BillingRecord[]>('/billing');
      if (res.success && res.data) setBillingRecords(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    const id = deleteId;
    if (!id) return;
    setDeleting(true);
    setDeleteId(null);
    try {
      const res = await api.delete(`/billing/${id}`);
      if (res?.success !== false) await load();
    } finally {
      setDeleting(false);
    }
  };

  const handleAddBilling = () => {
    navigate('/billing/new');
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const filteredRecords = billingRecords.filter(
    (b) =>
      b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (b.projectName && b.projectName.toLowerCase().includes(search.toLowerCase())) ||
      (b.phoneNumber && b.phoneNumber.includes(search))
  );

  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <button
          onClick={handleAddBilling}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Billing
        </button>
      </div>

      <div className={styles.filtersRow}>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by Name"
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
              <th className="px-6 py-4 text-orange-600 font-bold uppercase text-xs tracking-wider">Customer Name</th>
              <th className="px-6 py-4 text-orange-600 font-bold uppercase text-xs tracking-wider">Project Name</th>
              <th className="px-6 py-4 text-orange-600 font-bold uppercase text-xs tracking-wider">Billing Id</th>
              <th className="px-6 py-4 text-orange-600 font-bold uppercase text-xs tracking-wider">Price</th>
              <th className="px-6 py-4 text-orange-600 font-bold uppercase text-xs tracking-wider">Create Date</th>
              <th className="px-6 py-4 text-orange-600 font-bold uppercase text-xs tracking-wider">Phone Number</th>
              <th className="px-6 py-4 text-orange-600 font-bold uppercase text-xs tracking-wider text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No billing records yet.
                </td>
              </tr>
            ) : (
              <>
                {paginatedRecords.map((b) => (
                  <tr
                    key={b._id}
                    onClick={() => navigate(`/billing/${b._id}`)}
                    className="h-[60px] hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{b.customerName}</td>
                    <td className="px-6 py-4 text-gray-600">{b.projectName || 'N/A'}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {b.billingId || `INV ${b._id.slice(-6)}`}
                    </td>
                    <td className="px-6 py-4 text-gray-600">Rs. {b.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(b.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{b.phoneNumber || '—'}</td>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center items-center gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/billing/${b._id}`);
                          }}
                          className="text-gray-900 hover:text-primary transition-colors"
                          title="View"
                        >
                          <FileText size={20} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            api.download(`/billing/${b._id}/pdf`, `invoice-${b.customerName.replace(/\s+/g, '-')}.pdf`).catch((err) => {
                              console.error(err);
                              alert(err instanceof Error ? err.message : 'Failed to download invoice');
                            });
                          }}
                          className="text-gray-900 hover:text-primary transition-colors"
                          title="Download invoice"
                        >
                          <DownloadCloud size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteId(b._id)}
                          className="text-gray-900 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {Array.from({ length: Math.max(0, rowsPerPage - paginatedRecords.length) }).map(
                  (_, idx) => (
                    <tr key={`empty-${idx}`} className="h-[60px]">
                      <td className="px-6 py-4">&nbsp;</td>
                      <td className="px-6 py-4">&nbsp;</td>
                      <td className="px-6 py-4">&nbsp;</td>
                      <td className="px-6 py-4">&nbsp;</td>
                      <td className="px-6 py-4">&nbsp;</td>
                      <td className="px-6 py-4">&nbsp;</td>
                      <td className="px-6 py-4">&nbsp;</td>
                    </tr>
                  )
                )}
              </>
            )}
          </tbody>
        </table>

        <div className="px-6 py-3 bg-[#f9fafb] border-t border-[#fed7aa] flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>Rows Per Page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-orange-300"
            >
              <option value={8}>8</option>
              <option value={16}>16</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>
              {filteredRecords.length === 0
                ? '0-0 of 0'
                : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(
                    currentPage * rowsPerPage,
                    filteredRecords.length
                  )} of ${filteredRecords.length}`}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &lt;
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Billing"
        message="Are you sure you want to delete this billing record?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
