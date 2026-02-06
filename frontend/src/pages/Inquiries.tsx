
import { useState, useEffect } from 'react';
import { Plus, Search, ChevronDown, Download } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import NewInquiryModal from '../components/NewInquiryModal';

interface Inquiry {
  _id: string;
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  status: string;
  createdAt: string;
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
const getStatusColor = () => {
  return 'bg-white text-gray-700 border-primary/30 hover:border-primary';
};

export default function Inquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const load = () => {
    // In a real app, I'd debounce search and pass it to API. 
    // For now, I'll filter client-side or assume API supports it if I added it.
    // The current API only supports 'status'.
    const q = filter ? `?status=${filter}` : '';
    api.get<Inquiry[]>(`/inquiries${q}`).then((res) => {
      if (res.success && res.data) setInquiries(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [filter]);

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
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
        >
          + Add Inquiries
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-transparent text-primary font-bold border-b border-orange-100">
            <tr>
              <th className="px-6 py-4">Customer Name</th>
              <th className="px-6 py-4">Customer Id</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">proposal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
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
                    <div className="relative">
                      <select
                        value={inq.status}
                        onChange={(e) => updateStatus(inq._id, e.target.value)}
                        className={`appearance-none w-full pl-4 pr-10 py-2 rounded-full text-xs font-bold border uppercase tracking-wide cursor-pointer focus:outline-none transition-colors ${getStatusColor()}`}
                      >
                        {Object.keys(STATUS_LABELS).filter(k => k === k.toUpperCase()).map((statusKey) => (
                          <option key={statusKey} value={statusKey}>
                            {STATUS_LABELS[statusKey]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" size={14} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center gap-2">
                      {/* Logic for proposal button */}
                      {inq.status === 'PROPOSAL_SENT' || inq.status === 'NEGOTIATING' || inq.status === 'CONFIRMED' ? (
                        <>
                          <button className="flex-1 border border-primary/30 text-gray-700 hover:border-primary hover:bg-orange-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                            Download Proposal
                          </button>
                          <button className="p-2 text-gray-700 hover:text-primary transition-colors">
                            <Download size={18} />
                          </button>
                        </>
                      ) : (
                        <div className="flex w-full items-center gap-2">
                          <button className="flex-1 border border-primary/30 text-gray-700 hover:border-primary hover:bg-orange-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                            Create Proposal
                          </button>
                          <button className="p-2 border border-transparent hover:bg-orange-50 rounded-lg text-gray-700 hover:text-primary transition-colors">
                            <Plus size={18} />
                          </button>
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
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>Rows Per Page:</span>
            <select className="bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none">
              <option>10</option>
              <option>20</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>1-5 of 5</span>
            <div className="flex gap-1">
              <button className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50" disabled>&lt; Previous</button>
              <button className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">Next &gt;</button>
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
