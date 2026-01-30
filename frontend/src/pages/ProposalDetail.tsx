import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Download } from 'lucide-react';
import { api } from '../api/client';
import styles from './ProposalDetail.module.css';

interface Proposal {
  _id: string;
  inquiryId: string;
  customerName: string;
  projectDescription: string;
  requiredFeatures: string[];
  totalAmount: number;
  validUntil?: string;
  notes?: string;
  milestones: { title: string; amount: number; description?: string; dueDate?: string }[];
  createdAt: string;
}

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<Proposal>(`/proposals/${id}`).then((res) => {
      if (res.success && res.data) setProposal(res.data);
      setLoading(false);
    });
  }, [id]);

  const downloadPdf = async () => {
    if (!proposal) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/v1/proposals/${proposal._id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposal-${proposal.customerName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className={styles.muted}>Loading...</p>;
  if (!proposal) return <p className={styles.muted}>Proposal not found.</p>;

  return (
    <div>
      <div className={styles.header}>
        <Link to="/proposals" className={styles.back}>← Proposals</Link>
        <h1 className={styles.title}>Proposal — {proposal.customerName}</h1>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Auto-filled (read-only)</h2>
        <p><strong>Customer Name:</strong> {proposal.customerName}</p>
        <p><strong>Project Description:</strong></p>
        <p className={styles.body}>{proposal.projectDescription}</p>
        {proposal.requiredFeatures?.length > 0 && (
          <>
            <strong>Required Features:</strong>
            <div className={styles.chips}>
              {proposal.requiredFeatures.map((f, i) => (
                <span key={i} className={styles.chip}>{f}</span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pricing</h2>
        <p><strong>Total Amount:</strong> ${proposal.totalAmount.toLocaleString()}</p>
        {proposal.validUntil && (
          <p><strong>Valid Until:</strong> {format(new Date(proposal.validUntil), 'MMM d, yyyy')}</p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Milestones</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {proposal.milestones.map((m, i) => (
                <tr key={i}>
                  <td>{m.title}</td>
                  <td>${m.amount.toLocaleString()}</td>
                  <td>{m.description || '—'}</td>
                  <td>{m.dueDate ? format(new Date(m.dueDate), 'MMM d, yyyy') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.actionBar}>
        <Link to="/proposals" className={styles.cancelBtn}>Cancel</Link>
        <button type="button" onClick={downloadPdf} className={styles.primaryButton}>
          <Download size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Download PDF
        </button>
      </div>
    </div>
  );
}
