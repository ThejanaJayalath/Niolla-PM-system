import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, DownloadCloud, Trash2 } from 'lucide-react';
import { api, getPdfDownloadUrl } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './Inquiries.module.css';

interface Proposal {
  _id: string;
  inquiryId?: string;
  proposalId?: string;
  customerName: string;
  projectName?: string;
  totalAmount: number;
  createdAt: string;
  validUntil?: string;
}

export default function Proposals() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const res = await api.get<Proposal[]>('/proposals');
      if (res.success && res.data) {
        setProposals(res.data);
      }
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
    if (!deleteId) return;
    setDeleting(true);
    const res = await api.delete(`/proposals/${deleteId}`);
    setDeleting(false);
    setDeleteId(null);
    if (res?.success !== false) load();
  };

  const handleDownload = async (id: string, customerName: string) => {
    try {
      await api.download(`/proposals/${id}/pdf`, `proposal-${customerName.replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to download proposal');
    }
  };

  const handleDownloadWord = async (id: string, customerName: string) => {
    try {
      await api.download(`/proposals/${id}/pdf?format=docx`, `proposal-${customerName.replace(/\s+/g, '-')}.docx`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to download proposal');
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const filteredProposals = proposals.filter(p =>
    p.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (p.projectName && p.projectName.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredProposals.length / rowsPerPage);
  const paginatedProposals = filteredProposals.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
        <button
          onClick={() => navigate('/proposals/new')}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Proposal
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
              <th className="px-6 py-4 w-[20%] text-orange-600 font-bold uppercase text-xs tracking-wider">Customer Name</th>
              <th className="px-6 py-4 w-[25%] text-orange-600 font-bold uppercase text-xs tracking-wider">Project Name</th>
              <th className="px-6 py-4 w-[15%] text-orange-600 font-bold uppercase text-xs tracking-wider">Proposal Id</th>
              <th className="px-6 py-4 w-[15%] text-orange-600 font-bold uppercase text-xs tracking-wider">Price</th>
              <th className="px-6 py-4 w-[15%] text-orange-600 font-bold uppercase text-xs tracking-wider">Create Date</th>
              <th className="px-6 py-4 w-[10%] text-orange-600 font-bold uppercase text-xs tracking-wider text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : (
              <>
                {/* Render actual proposals */}
                {paginatedProposals.map((p) => (
                  <tr
                    key={p._id}
                    onClick={() => navigate(`/proposals/${p._id}`)}
                    className="h-[60px] hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{p.customerName}</td>
                    <td className="px-6 py-4 text-gray-600">{p.projectName || 'N/A'}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {p.proposalId || `Proposal_num${(proposals.length - filteredProposals.indexOf(p)).toString().padStart(2, '0')}`}
                    </td>
                    <td className="px-6 py-4 text-gray-600">Rs. {p.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center items-center gap-4">
                        <button
                          onClick={() => window.open(getPdfDownloadUrl(p._id), '_blank')}
                          className="text-gray-900 hover:text-primary transition-colors"
                          title="View PDF"
                        >
                          <FileText size={20} />
                        </button>
                        <button
                          onClick={() => handleDownloadWord(p._id, p.customerName)}
                          className="text-gray-900 hover:text-primary transition-colors"
                          title="Download as Word (uses template)"
                        >
                          <FileText size={20} />
                        </button>
                        <button
                          onClick={() => handleDownload(p._id, p.customerName)}
                          className="text-gray-900 hover:text-primary transition-colors"
                          title="Download PDF"
                        >
                          <DownloadCloud size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteId(p._id)}
                          className="text-gray-900 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Fill remaining rows to always show rowsPerPage total */}
                {Array.from({ length: Math.max(0, rowsPerPage - paginatedProposals.length) }).map((_, idx) => (
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

        {/* Pagination footer */}
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
              {filteredProposals.length === 0 ? '0-0 of 0' : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, filteredProposals.length)} of ${filteredProposals.length}`}
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
        title="Delete Proposal"
        message="Are you sure you want to delete this proposal?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
