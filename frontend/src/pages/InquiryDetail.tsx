import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, FileText, Download, Pencil } from 'lucide-react';
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
  completed?: boolean;
}

interface Proposal {
  _id: string;
  inquiryId: string;
  customerName: string;
  totalAmount: number;
  milestones: { title: string; amount: number }[];
}

const STATUS_OPTIONS = ['new', 'contacted', 'proposal_sent', 'negotiating', 'won', 'lost'];


export default function InquiryDetail() {
  const { id } = useParams<{ id: string }>();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminderForm, setReminderForm] = useState({ type: 'reminder' as 'reminder' | 'meeting', title: '', scheduledAt: '', notes: '' });
  const [proposalForm, setProposalForm] = useState({ projectName: '', totalAmount: '', validUntil: '', notes: '', milestones: [{ title: '', amount: '' }] });
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);

  const load = () => {
    if (!id) return;
    Promise.all([
      api.get<Inquiry>(`/inquiries/${id}`),
      api.get<Reminder[]>(`/reminders/inquiry/${id}`),
      api.get<Proposal>(`/proposals/inquiry/${id}`).then((r) => (r.success && r.data ? r : { success: false, data: null })),
    ]).then(([inqRes, remRes, propRes]) => {
      if (inqRes.success && inqRes.data) setInquiry(inqRes.data);
      if (remRes.success && remRes.data) setReminders(remRes.data);
      if (propRes.success && propRes.data) setProposal(propRes.data as Proposal);
      setLoading(false);
    });
  };

  useEffect(() => load(), [id]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    const res = await api.patch<Inquiry>(`/inquiries/${id}`, { status });
    if (res.success && res.data) setInquiry(res.data);
  };

  const addReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const res = await api.post<Reminder>('/reminders', {
      inquiryId: id,
      type: reminderForm.type,
      title: reminderForm.title,
      scheduledAt: reminderForm.scheduledAt,
      notes: reminderForm.notes || undefined,
    });
    if (res.success) {
      setReminderForm({ type: 'reminder', title: '', scheduledAt: '', notes: '' });
      setShowReminderForm(false);
      load();
    }
  };

  const createProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const milestones = proposalForm.milestones
      .filter((m) => m.title.trim())
      .map((m) => ({ title: m.title.trim(), amount: Number(m.amount) || 0 }));
    const totalAmount = milestones.reduce((s, m) => s + m.amount, 0);
    const res = await api.post<Proposal>('/proposals', {
      inquiryId: id,
      projectName: proposalForm.projectName.trim() || undefined,
      milestones,
      totalAmount,
      validUntil: proposalForm.validUntil || undefined,
      notes: proposalForm.notes || undefined,
    });
    if (res.success && res.data) {
      setProposal(res.data);
      setShowProposalForm(false);
    }
  };

  const downloadPdf = async (proposalId: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/v1/proposals/${proposalId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposal-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !inquiry) return <p className={styles.emptyState}>Loading...</p>;

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerInfo}>
            <Link to="/inquiries" className={styles.back}>← Back to Inquiries</Link>
            <h1 className={styles.title}>{inquiry.customerName}</h1>
            <div className={styles.metaRow}>
              <span>{inquiry.phoneNumber}</span>
              <span>•</span>
              <span>Created {format(new Date(inquiry.createdAt), 'MMM d, yyyy')}</span>
              <select
                value={inquiry.status}
                onChange={(e) => updateStatus(e.target.value)}
                className={styles.statusSelect}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.actionBar}>
            <Link to={`/inquiries/${id}/edit`} className={styles.actionBtn}>
              <Pencil size={18} /> Edit Inquiry
            </Link>
            <button type="button" onClick={() => setShowReminderForm(!showReminderForm)} className={styles.actionBtn}>
              <Plus size={18} /> Add Reminder
            </button>
            {!proposal && (
              <button type="button" onClick={() => setShowProposalForm(!showProposalForm)} className={styles.actionBtn}>
                <FileText size={18} /> Create Proposal
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Main Content Column */}
        <div className={styles.mainContent}>
          {/* Project Details Card */}
          <div className={styles.glassCard}>
            <h3 className={styles.cardTitle}>Project Details</h3>

            <div>
              <span className={styles.label}>Description</span>
              <p className={styles.bodyText}>{inquiry.projectDescription}</p>
            </div>

            {inquiry.requiredFeatures?.length > 0 && (
              <div>
                <span className={styles.label}>Required Features</span>
                <div className={styles.chips}>
                  {inquiry.requiredFeatures.map((f, i) => (
                    <span key={i} className={styles.chip}>{f}</span>
                  ))}
                </div>
              </div>
            )}

            {inquiry.internalNotes && (
              <div>
                <span className={styles.label}>Internal Notes</span>
                <p className={styles.bodyText}>{inquiry.internalNotes}</p>
              </div>
            )}
          </div>

          {/* Proposal Form (Inline) */}
          {showProposalForm && !proposal && (
            <div className={styles.inlineForm}>
              <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Create Proposal</h3>
              <form onSubmit={createProposal}>
                <div className={styles.formGrid}>
                  <div>
                    <span className={styles.label}>Project Name</span>
                    <input
                      placeholder="e.g. CRM System"
                      value={proposalForm.projectName}
                      onChange={(e) => setProposalForm((f) => ({ ...f, projectName: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                  <div>
                    <span className={styles.label}>Milestones</span>
                    {proposalForm.milestones.map((m, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                          placeholder="Title"
                          value={m.title}
                          onChange={(e) => {
                            const next = [...proposalForm.milestones];
                            next[i] = { ...next[i], title: e.target.value };
                            setProposalForm((f) => ({ ...f, milestones: next }));
                          }}
                          className={styles.input}
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={m.amount}
                          onChange={(e) => {
                            const next = [...proposalForm.milestones];
                            next[i] = { ...next[i], amount: e.target.value };
                            setProposalForm((f) => ({ ...f, milestones: next }));
                          }}
                          className={styles.input}
                          style={{ width: '120px' }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setProposalForm((f) => ({ ...f, milestones: [...f.milestones, { title: '', amount: '' }] }))}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      + Add another milestone
                    </button>
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button type="button" onClick={() => setShowProposalForm(false)} className={styles.btnCancel}>Cancel</button>
                  <button type="submit" className={styles.btnSave}>Create Proposal</button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <div className={styles.sidebar}>

          {/* Proposal Summary Card (if exists) */}
          {proposal && (
            <div className={styles.glassCard}>
              <h3 className={styles.cardTitle}>
                <FileText size={20} /> Active Proposal
              </h3>
              <div className={styles.proposalSummary}>
                <div className={styles.proposalAmount}>${proposal.totalAmount.toLocaleString()}</div>
                <ul className={styles.proposalList}>
                  {proposal.milestones.map((m, i) => (
                    <li key={i} className={styles.proposalItem}>
                      <span>{m.title}</span>
                      <span>${m.amount.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => downloadPdf(proposal._id)} className={styles.btnPrimary}>
                    <Download size={16} /> Download PDF
                  </button>
                  <Link to={`/proposals/${proposal._id}`} className={styles.btnCancel} style={{ textAlign: 'center', flex: 1 }}>
                    View
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Reminders Card */}
          <div className={styles.glassCard}>
            <h3 className={styles.cardTitle}>
              Reminders & Meetings
            </h3>

            {showReminderForm && (
              <div className={styles.inlineForm} style={{ marginBottom: 0, padding: '1rem' }}>
                <form onSubmit={addReminder}>
                  <div className={styles.formGrid}>
                    <select
                      value={reminderForm.type}
                      onChange={(e) => setReminderForm((f) => ({ ...f, type: e.target.value as 'reminder' | 'meeting' }))}
                      className={styles.input}
                    >
                      <option value="reminder">Reminder</option>
                      <option value="meeting">Meeting</option>
                    </select>
                    <input
                      placeholder="Title"
                      value={reminderForm.title}
                      onChange={(e) => setReminderForm((f) => ({ ...f, title: e.target.value }))}
                      required
                      className={styles.input}
                    />
                    <input
                      type="datetime-local"
                      value={reminderForm.scheduledAt}
                      onChange={(e) => setReminderForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                      required
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formActions}>
                    <button type="button" onClick={() => setShowReminderForm(false)} className={styles.btnCancel}>Cancel</button>
                    <button type="submit" className={styles.btnSave}>Save</button>
                  </div>
                </form>
              </div>
            )}

            {reminders.length === 0 && !showReminderForm ? (
              <p className={styles.emptyState}>No upcoming reminders.</p>
            ) : (
              <ul className={styles.timeline}>
                {reminders.map((r) => (
                  <li key={r._id} className={styles.timelineItem}>
                    <div className={styles.timelineDateBox}>
                      <span className={styles.timelineDay}>{format(new Date(r.scheduledAt), 'd')}</span>
                      <span className={styles.timelineMonth}>{format(new Date(r.scheduledAt), 'MMM')}</span>
                    </div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTitle}>{r.title}</div>
                      <div className={styles.timelineMeta}>
                        {format(new Date(r.scheduledAt), 'h:mm a')} • {r.type}
                      </div>
                      {r.notes && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{r.notes}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
