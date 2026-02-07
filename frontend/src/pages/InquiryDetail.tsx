
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import {
  ArrowLeft,
  ChevronDown,
  Edit3,
  Trash2,
  Bell,
  FileText,
  Download,
  Users,
  X
} from 'lucide-react';
import { api } from '../api/client';
import styles from './InquiryDetail.module.css';

interface Inquiry {
  _id: string;
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes?: string;
  status: string;
  createdAt: string;
}

interface Reminder {
  _id: string;
  inquiryId: string;
  type: string;
  title: string;
  scheduledAt: string;
  notes?: string;
}

interface Proposal {
  _id: string;
  inquiryId: string;
  customerName: string;
  projectName?: string;
  totalAmount: number;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATING: 'Negotiating',
  CONFIRMED: 'Confirmed',
  LOST: 'Lost',
  // Compat
  new: 'New',
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



export default function InquiryDetail() {
  const { id } = useParams<{ id: string }>();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customerName: '',
    phoneNumber: '',
    projectDescription: '',
    requiredFeatures: [] as string[],
    internalNotes: ''
  });
  const [newFeature, setNewFeature] = useState('');

  const load = () => {
    if (!id) return;
    Promise.all([
      api.get<Inquiry>(`/inquiries/${id}`),
      api.get<Reminder[]>(`/reminders/inquiry/${id}`),
      api.get<Proposal[]>(`/proposals/inquiry/${id}`) // Now returns array
    ]).then(([inqRes, remRes, propRes]) => {
      if (inqRes.success && inqRes.data) {
        setInquiry(inqRes.data);
        setEditForm({
          customerName: inqRes.data.customerName,
          phoneNumber: inqRes.data.phoneNumber,
          projectDescription: inqRes.data.projectDescription,
          requiredFeatures: inqRes.data.requiredFeatures || [],
          internalNotes: inqRes.data.internalNotes || ''
        });
      }
      if (remRes.success && remRes.data) setReminders(remRes.data);
      if (propRes.success && propRes.data) setProposals(propRes.data);
      setLoading(false);
    });
  };

  useEffect(() => load(), [id]);

  const updateStatus = async (status: string) => {
    if (!id || !inquiry) return;
    // Optimistic update
    setInquiry({ ...inquiry, status });
    const res = await api.patch<Inquiry>(`/inquiries/${id}`, { status });
    if (!res.success) {
      // Revert on failure (reload)
      load();
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      const res = await api.patch<Inquiry>(`/inquiries/${id}`, {
        customerName: editForm.customerName,
        phoneNumber: editForm.phoneNumber,
        projectDescription: editForm.projectDescription,
        requiredFeatures: editForm.requiredFeatures,
        internalNotes: editForm.internalNotes
      });

      if (res.success && res.data) {
        setInquiry(res.data);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to save', err);
      alert('Failed to save inquiry details');
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Are you sure you want to delete this inquiry?')) return;
    try {
      await api.delete(`/inquiries/${id}`);
      window.location.href = '/inquiries';
    } catch (err) {
      console.error('Failed to delete', err);
      alert('Failed to delete inquiry');
    }
  };

  const addFeature = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newFeature.trim()) {
      e.preventDefault();
      if (!editForm.requiredFeatures.includes(newFeature.trim())) {
        setEditForm(prev => ({
          ...prev,
          requiredFeatures: [...prev.requiredFeatures, newFeature.trim()]
        }));
      }
      setNewFeature('');
    }
  };

  const removeFeature = (feature: string) => {
    setEditForm(prev => ({
      ...prev,
      requiredFeatures: prev.requiredFeatures.filter(f => f !== feature)
    }));
  };

  const handleDownloadProposal = async (proposalId: string) => {
    try {
      // Assuming generic download handler
      // await (api as any).download(...)
      console.log(`Downloading ${proposalId}`);
      alert('Download functionality would integrate here');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (!inquiry) {
    return <div className={styles.container}>Inquiry not found.</div>;
  }

  return (
    <div className={styles.container}>
      {/* Back Button */}
      <div className="flex flex-col gap-4 mb-6">
        <Link to="/inquiries" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors w-fit">
          <ArrowLeft size={20} />
          <span className="font-medium text-lg">Back</span>
        </Link>
        <div className={styles.breadcrumb}>
          <span>Home</span> &gt; <span>Inquiries</span> &gt; <span className="font-semibold">Inquiries Details</span>
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{inquiry.customerName}</h1>
          <p className={styles.subTitle}>E-commerce web site</p>
        </div>
        <button onClick={handleDelete} className={styles.deleteBtn}>
          <Trash2 size={16} /> Delete Inquiries
        </button>
      </div>

      <div className={styles.grid}>
        {/* Main Content */}
        <div className={styles.mainCard}>
          <div className={styles.cardHeader}>
            <div className="flex items-center gap-4">
              <h2 className={styles.cardTitle}>Inquiries Details</h2>
              <div className="relative w-48">
                <select
                  value={inquiry.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className={`appearance-none w-full pl-4 pr-10 py-2 rounded-full text-xs font-bold border uppercase tracking-wide cursor-pointer focus:outline-none transition-colors shadow-sm ${getStatusColor(inquiry.status)}`}
                >
                  {Object.keys(STATUS_LABELS).filter(k => k === k.toUpperCase()).map((statusKey) => (
                    <option key={statusKey} value={statusKey}>
                      {STATUS_LABELS[statusKey]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={14} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <button onClick={handleSave} className={styles.saveBtn}>Save Inquiries</button>
              ) : (
                <button onClick={() => setIsEditing(true)} className={styles.editBtn}>
                  <Edit3 size={16} /> Edit Inquiries
                </button>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Name</label>
            <input
              value={isEditing ? editForm.customerName : inquiry.customerName}
              onChange={e => setEditForm({ ...editForm, customerName: e.target.value })}
              readOnly={!isEditing}
              className={isEditing ? styles.inputParam : styles.inputReadonly}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Phone Number</label>
            <input
              value={isEditing ? editForm.phoneNumber : inquiry.phoneNumber}
              onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
              readOnly={!isEditing}
              className={isEditing ? styles.inputParam : styles.inputReadonly}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea
              value={isEditing ? editForm.projectDescription : inquiry.projectDescription}
              onChange={e => setEditForm({ ...editForm, projectDescription: e.target.value })}
              readOnly={!isEditing}
              className={isEditing ? styles.inputParam : styles.inputReadonly}
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Required Features</label>
            <div className="flex flex-col gap-3">
              <div className={styles.chipContainer}>
                {(isEditing ? editForm.requiredFeatures : inquiry.requiredFeatures).map((f, i) => (
                  <span key={i} className={`${styles.chip} flex items-center gap-1 pr-2`}>
                    {f}
                    {isEditing && (
                      <button
                        onClick={() => removeFeature(f)}
                        className="hover:text-red-500 rounded-full p-0.5 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </span>
                ))}
                {(!isEditing && inquiry.requiredFeatures.length === 0) && (
                  <span className="text-gray-400 italic text-sm">No features specified</span>
                )}
              </div>

              {isEditing && (
                <input
                  value={newFeature}
                  onChange={e => setNewFeature(e.target.value)}
                  onKeyDown={addFeature}
                  className={styles.inputParam}
                  placeholder="Type feature and press Enter to add..."
                />
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Notes</label>
            <textarea
              value={isEditing ? editForm.internalNotes : (inquiry.internalNotes || 'If you want it more technical, more marketing-style... (Placeholder if empty)')}
              onChange={e => setEditForm({ ...editForm, internalNotes: e.target.value })}
              readOnly={!isEditing}
              className={isEditing ? styles.inputParam : styles.inputReadonly}
              rows={3}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>

          {/* Active Proposal */}
          <div className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <FileText size={18} className="text-orange-500" />
              <h3>Active Proposal</h3>
            </div>

            <div className={styles.listContainer}>
              {proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="bg-orange-100 p-4 rounded-full mb-3">
                    <FileText size={32} className="text-orange-500" />
                  </div>
                  <p className="text-gray-500 font-medium">No Active Proposal</p>
                </div>
              ) : (
                proposals.map(p => (
                  <div key={p._id} className={styles.listItem}>
                    <span className="truncate flex-1 font-medium text-gray-700">
                      {p.projectName || `Proposal #${p._id.substr(-4)}`}
                    </span>
                    <button onClick={() => handleDownloadProposal(p._id)} className="text-gray-500 hover:text-gray-800">
                      <Download size={16} />
                    </button>
                    <button className="text-gray-500 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => alert('Open Create Proposal Modal')}
              className={styles.orangeBtn}
            >
              Create New Proposal
            </button>
          </div>

          {/* Active Meetings */}
          <div className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <Users size={18} className="text-orange-500" />
              <h3>Active Meetings</h3>
            </div>

            <div className={styles.listContainer}>
              {reminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="bg-orange-100 p-4 rounded-full mb-3">
                    <Users size={32} className="text-orange-500" />
                  </div>
                  <p className="text-gray-500 font-medium">No Active Meetings</p>
                </div>
              ) : (
                reminders.map(r => (
                  <div key={r._id} className={styles.listItem}>
                    <span className="truncate flex-1 font-medium text-gray-700">
                      {r.title}
                    </span>
                    <button className="text-gray-500 hover:text-gray-800">
                      <Bell size={16} />
                    </button>
                    <button className="text-gray-500 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              className={styles.orangeBtn}
              onClick={() => alert('Open Create Meeting Modal')}
            >
              Create New Meetings
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
