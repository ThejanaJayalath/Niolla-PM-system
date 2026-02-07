
import { useState, useEffect } from 'react';
import { Plus, Search, ChevronDown, Download } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import NewInquiryModal from '../components/NewInquiryModal';
import styles from './Inquiries.module.css';

interface Inquiry {
  _id: string;
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  status: string;
  createdAt: string;
  proposals?: {
    _id: string;
    createdAt: string;
    status: 'CREATED' | 'DOWNLOADED';
  }[];
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATING: 'Negotiating',
  CONFIRMED: 'Confirmed',
  LOST: 'Lost',
  // Keep compatibility with old data just in case
  new: 'New',
  contacted: 'Contacted',
  proposal_sent: 'Proposal Sent',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
};

// Helper for status colors
const getStatusColor = (status: string) => {
  const s = status.toLowerCase();
  // Exact match to Image 2 colors
  if (s === 'new') return 'bg-white text-orange-500 border-orange-200 hover:border-orange-300';
  if (s === 'proposal_sent') return 'bg-[#d1d5db] text-gray-700 border-transparent'; // Proposal Sent (Gray pill)
  if (s === 'negotiating') return 'bg-[#f3e8ff] text-purple-600 border-transparent'; // Negotiating (Purple pill)
  if (s === 'confirmed') return 'bg-[#dcfce7] text-green-600 border-transparent'; // Confirmed (Green pill)
  if (s === 'lost') return 'bg-[#fee2e2] text-red-600 border-transparent'; // Lost (Red pill)
  return 'bg-white text-gray-700 border-gray-200';
};

export default function Inquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.append('status', filter);
      if (search) params.append('search', search);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<Inquiry[]>(`/inquiries${queryString}`);
      if (res.success && res.data) {
        setInquiries(res.data);
      }
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
    }, 500); // Debounce search
    return () => clearTimeout(timer);
  }, [filter, search]);

  const handleCreateProposal = async (id: string) => {
    try {
      const res = await api.post('/proposals', {
        inquiryId: id,
        totalAmount: 0,
        milestones: [{ title: 'Initial Draft', amount: 0 }],
        notes: 'Auto-generated draft'
      });

      if (res.success) {
        load();
      } else {
        console.error('Failed to create proposal', res.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadProposal = async (proposalId: string) => {
    try {
      await (api as any).download(`/proposals/${proposalId}/pdf`, `proposal-${proposalId}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to download proposal');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const res = await api.delete(`/inquiries/${deleteId}`);
    setDeleting(false);
    setDeleteId(null);
    if (res?.success !== false) load();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setInquiries((prev) =>
      prev.map((inq) => (inq._id === id ? { ...inq, status: newStatus } : inq))
    );
    const res = await api.patch<Inquiry>(`/inquiries/${id}`, { status: newStatus });
    if (!res.success) load();
  };

  const filteredInquiries = inquiries.filter(inq =>
    inq.customerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Inquiries
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

        <div className="relative w-48">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="">All Status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 w-[20%]">Customer Name</th>
              <th className="px-6 py-4 w-[15%]">Customer Id</th>
              <th className="px-6 py-4 w-[30%]">Description</th>
              <th className="px-6 py-4 w-[15%]">Status</th>
              <th className="px-6 py-4 w-[20%] text-center">proposal</th>
            </tr>
          </thead>
          <tbody className="divide-y-0"> {/* divide-y-0 because we use border-spacing */}
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : filteredInquiries.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No inquiries found.</td></tr>
            ) : (
              filteredInquiries.map((inq) => (
                <tr key={inq._id} className="hover:bg-gray-50 transition-colors group cursor-default">
                  <td className="px-6 py-4 font-medium text-gray-900">{inq.customerName}</td>
                  <td className="px-6 py-4 text-gray-600">{inq.phoneNumber}</td>
                  <td className="px-6 py-4 text-gray-600 truncate max-w-xs" title={inq.projectDescription}>
                    {inq.projectDescription}
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative w-40">
                      <select
                        value={inq.status}
                        onChange={(e) => updateStatus(inq._id, e.target.value)}
                        className={`appearance-none w-full pl-4 pr-10 py-2 rounded-full text-xs font-bold border uppercase tracking-wide cursor-pointer focus:outline-none transition-colors shadow-sm ${getStatusColor(inq.status)}`}
                      >
                        {Object.keys(STATUS_LABELS).filter(k => k === k.toUpperCase()).map((statusKey) => (
                          <option key={statusKey} value={statusKey}>
                            {STATUS_LABELS[statusKey]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={14} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center w-full max-w-[200px] mx-auto">
                      {/* Proposal Logic */}
                      {(!inq.proposals || inq.proposals.length === 0) ? (
                        <button
                          onClick={() => handleCreateProposal(inq._id)}
                          className="w-full flex items-center justify-between border border-orange-200 bg-white text-gray-800 hover:border-orange-400 hover:bg-orange-50 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm"
                        >
                          <span>Create Proposal</span>
                          <Plus size={16} />
                        </button>
                      ) : inq.proposals.length === 1 ? (
                        <div className="flex w-full gap-2">
                          <button className="flex-1 border border-orange-200 bg-white text-gray-800 hover:border-orange-400 hover:bg-orange-50 px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-between shadow-sm">
                            <span>Download Proposal</span>
                            <Download size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative w-full group">
                          <button className="w-full border border-orange-200 bg-white text-gray-800 hover:border-orange-400 hover:bg-orange-50 px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-between shadow-sm">
                            <span>Proposal List</span>
                            <ChevronDown size={16} />
                          </button>
                          {/* Simple dropdown mock */}
                          <div className="absolute top-right-0 w-full bg-white border border-gray-100 shadow-lg rounded-lg mt-1 hidden group-hover:block z-20">
                            {inq.proposals.map((_, i) => (
                              <div key={i} className="px-4 py-2 hover:bg-gray-50 text-sm cursor-pointer border-b border-gray-50 last:border-0">
                                Proposal #{i + 1}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination placeholder (mock) */}
        <div className="px-6 py-3 bg-[#eff6ff] border-t border-[#fed7aa] flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>Rows Per Page:</span>
            <select className="bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-orange-300">
              <option>10</option>
              <option>20</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>1-5 of 5</span>
            <div className="flex gap-1">
              <button className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50" disabled>&lt;</button>
              <button className="px-2 py-1 border border-gray-300 rounded hover:bg-white">&gt;</button>
            </div>
          </div>
        </div>
      </div>

      <NewInquiryModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSuccess={load}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete inquiry"
        message="Are you sure you want to delete this inquiry?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
