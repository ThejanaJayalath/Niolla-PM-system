import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import styles from './Inquiries.module.css';

interface Inquiry {
  _id: string;
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  status: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  proposal_sent: 'Proposal Sent',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
};

export default function Inquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    const q = filter ? `?status=${filter}` : '';
    api.get<Inquiry[]>(`/inquiries${q}`).then((res) => {
      if (res.success && res.data) setInquiries(res.data);
      setLoading(false);
    });
  }, [filter]);

  return (
    <div>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Inquiries</h1>
        <div className={styles.actions}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.select}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Link to="/inquiries/new" className={styles.primaryButton}>New inquiry</Link>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading...</p>
      ) : inquiries.length === 0 ? (
        <div className={styles.empty}>
          <p>No inquiries yet.</p>
          <Link to="/inquiries/new">Create your first inquiry</Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {inquiries.map((inq) => (
            <li key={inq._id} className={styles.item}>
              <Link to={`/inquiries/${inq._id}`} className={styles.itemLink}>
                <div className={styles.itemHeader}>
                  <span className={styles.name}>{inq.customerName}</span>
                  <span className={styles.status}>{STATUS_LABELS[inq.status] || inq.status}</span>
                </div>
                <div className={styles.itemMeta}>
                  {inq.phoneNumber} · {inq.projectDescription.slice(0, 80)}
                  {inq.projectDescription.length > 80 ? '…' : ''}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
