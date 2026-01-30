import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Check, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import styles from './Reminders.module.css';

interface ReminderWithInquiry {
  _id: string;
  inquiryId: string | { _id: string; customerName?: string };
  type: string;
  title: string;
  scheduledAt: string;
  notes?: string;
  completed?: boolean;
}

function getInquiryDisplay(inq: ReminderWithInquiry['inquiryId']): string {
  if (!inq) return 'Unknown';
  if (typeof inq === 'object' && inq !== null && 'customerName' in inq)
    return (inq as { customerName?: string }).customerName || 'Inquiry';
  return 'Inquiry';
}

function getInquiryId(inq: ReminderWithInquiry['inquiryId']): string {
  if (!inq) return '';
  if (typeof inq === 'object' && inq !== null && '_id' in inq) return (inq as { _id: string })._id;
  return String(inq);
}

export default function Reminders() {
  const [reminders, setReminders] = useState<ReminderWithInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = () => {
    api.get<ReminderWithInquiry[]>('/reminders/upcoming?limit=100').then((res) => {
      if (res.success && res.data) setReminders(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  const markCompleted = async (id: string) => {
    setCompletingId(id);
    await api.patch(`/reminders/${id}`, { completed: true });
    setCompletingId(null);
    load();
  };

  return (
    <div>
      <h1 className={styles.title}>Reminders</h1>
      {loading ? (
        <p className={styles.muted}>Loading...</p>
      ) : reminders.length === 0 ? (
        <div className={styles.empty}>
          <p>No upcoming reminders or meetings.</p>
          <p className={styles.emptyHint}>Add them from an inquiry detail page (Reminders tab).</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date & time</th>
                <th>Inquiry name</th>
                <th>Reminder title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r._id}>
                  <td>{format(new Date(r.scheduledAt), 'MMM d, yyyy · HH:mm')}</td>
                  <td className={styles.cellName}>{getInquiryDisplay(r.inquiryId)}</td>
                  <td>{r.title}</td>
                  <td>
                    <span className={`${styles.badge} ${r.type === 'meeting' ? styles.badgeMeeting : styles.badgeReminder}`}>
                      {r.type}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} badge-pending`}>Pending</span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Mark as completed"
                        aria-label="Mark as completed"
                        onClick={() => markCompleted(r._id)}
                        disabled={completingId === r._id}
                      >
                        <Check size={18} />
                      </button>
                      <Link
                        to={`/inquiries/${getInquiryId(r.inquiryId)}`}
                        className={styles.iconBtn}
                        title="View inquiry"
                        aria-label="View inquiry"
                      >
                        <ExternalLink size={18} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
