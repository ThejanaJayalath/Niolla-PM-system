
import { useState, useEffect } from 'react';
import { Plus, Search, Download, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import NewProposalModal from '../components/NewProposalModal';
import styles from './Inquiries.module.css'; // Reuse styles for consistency

interface Proposal {
  _id: string;
  customerName: string;
  projectName?: string;
  totalAmount: number;
  createdAt: string;
}

export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

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
      await (api as any).download(`/proposals/${id}/pdf`, `proposal-${customerName.replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to download proposal');
    }
  };

  const filteredProposals = proposals.filter(p =>
    p.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (p.projectName && p.projectName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          create Proposal
        </button>
      </div>

      <div className="flex gap-4 items-center">
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
              <th className="px-6 py-4">Customer Name</th>
              <th className="px-6 py-4">Price (LKR)</th>
              <th className="px-6 py-4">Created Date</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : filteredProposals.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No proposals found.</td></tr>
            ) : (
              filteredProposals.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {p.customerName}
                    {p.projectName && <div className="text-xs text-gray-500 font-normal">{p.projectName}</div>}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    Rs. {p.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => handleDownload(p._id, p.customerName)}
                        className="p-2 text-gray-500 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                        title="Download PDF"
                      >
                        <Download size={18} />
                      </button>
                      <button
                        onClick={() => setDeleteId(p._id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

      {/* 
        We use a placeholder here until NewProposalModal is implemented. 
        Usually I'd import it, but I haven't created it yet. 
        I'll create it in the next step.
      */}
      {showNewModal && <NewProposalModal open={showNewModal} onClose={() => setShowNewModal(false)} onSuccess={load} />}
    </div>
  );
}
