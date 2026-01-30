import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { api } from '../api/client';
import styles from './Reminders.module.css';

interface ReminderWithInquiry {
  _id: string;
  inquiryId: string | { _id: string; customerName?: string; phoneNumber?: string };
  type: string;
  title: string;
  scheduledAt: string;
  notes?: string;
  completed?: boolean;
}

function getInquiryDisplay(inq: ReminderWithInquiry['inquiryId']): string {
  if (!inq) return 'Unknown';
  if (typeof inq === 'object' && inq !== null && 'customerName' in inq) return (inq as { customerName?: string }).customerName || 'Inquiry';
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

  useEffect(() => {
    api.get<ReminderWithInquiry[]>('/reminders/upcoming?limit=50').then((res) => {
      if (res.success && res.data) setReminders(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 className={styles.title}>Upcoming reminders & meetings</h1>
      {loading ? (
        <p className={styles.muted}>Loading...</p>
      ) : reminders.length === 0 ? (
        <div className={styles.empty}>
          <p>No upcoming reminders or meetings.</p>
          <p className={styles.muted}>Add them from an inquiry detail page.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {reminders.map((r) => (
            <li key={r._id} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.type}>{r.type}</span>
                <span className={styles.date}>{format(new Date(r.scheduledAt), 'MMM d, yyyy · HH:mm')}</span>
              </div>
              <Link to={`/inquiries/${getInquiryId(r.inquiryId)}`} className={styles.itemLink}>
                <strong>{r.title}</strong>
              </Link>
              <p className={styles.inquiry}>Inquiry: {getInquiryDisplay(r.inquiryId)}</p>
              {r.notes && <p className={styles.notes}>{r.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
