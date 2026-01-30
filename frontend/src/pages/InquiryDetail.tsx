import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
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
  const [proposalForm, setProposalForm] = useState({ totalAmount: '', validUntil: '', notes: '', milestones: [{ title: '', amount: '' }] });
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

  if (loading || !inquiry) return <p className={styles.muted}>Loading...</p>;

  return (
    <div>
      <div className={styles.header}>
        <Link to="/inquiries" className={styles.back}>← Inquiries</Link>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{inquiry.customerName}</h1>
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
        <p className={styles.meta}>{inquiry.phoneNumber} · Created {format(new Date(inquiry.createdAt), 'MMM d, yyyy')}</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Project description</h2>
        <p className={styles.body}>{inquiry.projectDescription}</p>
        {inquiry.requiredFeatures?.length > 0 && (
          <>
            <h3 className={styles.subTitle}>Required features</h3>
            <ul className={styles.list}>
              {inquiry.requiredFeatures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </>
        )}
        {inquiry.internalNotes && (
          <>
            <h3 className={styles.subTitle}>Internal notes</h3>
            <p className={styles.body}>{inquiry.internalNotes}</p>
          </>
        )}
        <Link to={`/inquiries/${id}/edit`} className={styles.editLink}>Edit inquiry</Link>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Reminders & meetings</h2>
          <button type="button" onClick={() => setShowReminderForm(!showReminderForm)} className={styles.smallButton}>
            {showReminderForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showReminderForm && (
          <form onSubmit={addReminder} className={styles.form}>
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
            <input
              placeholder="Notes (optional)"
              value={reminderForm.notes}
              onChange={(e) => setReminderForm((f) => ({ ...f, notes: e.target.value }))}
              className={styles.input}
            />
            <button type="submit" className={styles.button}>Save</button>
          </form>
        )}
        <ul className={styles.reminderList}>
          {reminders.map((r) => (
            <li key={r._id} className={styles.reminderItem}>
              <span className={styles.reminderType}>{r.type}</span>
              <strong>{r.title}</strong> — {format(new Date(r.scheduledAt), 'MMM d, yyyy HH:mm')}
              {r.notes && <span className={styles.reminderNotes}>{r.notes}</span>}
            </li>
          ))}
          {reminders.length === 0 && !showReminderForm && <p className={styles.muted}>No reminders or meetings yet.</p>}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Sample proposal</h2>
          {proposal ? (
            <button type="button" onClick={() => downloadPdf(proposal._id)} className={styles.primaryButton}>
              Download PDF
            </button>
          ) : (
            <button type="button" onClick={() => setShowProposalForm(!showProposalForm)} className={styles.smallButton}>
              {showProposalForm ? 'Cancel' : '+ Create proposal'}
            </button>
          )}
        </div>
        {showProposalForm && !proposal && (
          <form onSubmit={createProposal} className={styles.form}>
            <p className={styles.formHint}>Milestones and pricing (filled from inquiry; adjust as needed)</p>
            {proposalForm.milestones.map((m, i) => (
              <div key={i} className={styles.milestoneRow}>
                <input
                  placeholder="Milestone title"
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
              className={styles.smallButton}
            >
              + Add milestone
            </button>
            <label className={styles.label}>
              Valid until (optional)
              <input
                type="date"
                value={proposalForm.validUntil}
                onChange={(e) => setProposalForm((f) => ({ ...f, validUntil: e.target.value }))}
                className={styles.input}
              />
            </label>
            <label className={styles.label}>
              Notes (optional)
              <input
                value={proposalForm.notes}
                onChange={(e) => setProposalForm((f) => ({ ...f, notes: e.target.value }))}
                className={styles.input}
              />
            </label>
            <button type="submit" className={styles.button}>Create proposal</button>
          </form>
        )}
        {proposal && !showProposalForm && (
          <div className={styles.proposalSummary}>
            <p>Total: ${proposal.totalAmount.toLocaleString()}</p>
            <ul>
              {proposal.milestones.map((m, i) => (
                <li key={i}>{m.title} — ${m.amount.toLocaleString()}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
