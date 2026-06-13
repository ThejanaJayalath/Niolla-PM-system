import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Plus, Video, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import CreateMeetingModal from '../components/CreateMeetingModal';
import styles from './Reminders.module.css';
import meetingStyles from './Meetings.module.css';

interface MeetingRow {
  _id: string;
  title: string;
  customerName?: string;
  scheduledAt: string;
  status?: string;
  recordingStatus?: string;
  meetingLink?: string;
  inquiryId?: string | { _id: string; customerName?: string };
}

function displayCustomer(m: MeetingRow): string {
  if (m.customerName) return m.customerName;
  const inq = m.inquiryId;
  if (inq && typeof inq === 'object' && 'customerName' in inq) {
    return inq.customerName || 'Unknown';
  }
  return 'Unknown';
}

function recordingLabel(status?: string): string {
  if (!status || status === 'none') return '—';
  return status;
}

export default function Meetings() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<MeetingRow[]>('/reminders?type=meeting&upcoming=false&limit=100').then((res) => {
      if (res.success && res.data) setMeetings(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className={styles.title} style={{ margin: 0 }}>Meetings</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={meetingStyles.scheduleBtn}
        >
          <Plus size={18} />
          Schedule meeting
        </button>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading...</p>
      ) : meetings.length === 0 ? (
        <div className={styles.empty}>
          <Calendar size={40} className="mx-auto mb-3 opacity-40" />
          <p>No meetings scheduled yet.</p>
          <p className={styles.emptyHint}>Create one from an inquiry or use Schedule meeting above.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date & time</th>
                <th>Customer</th>
                <th>Title</th>
                <th>Status</th>
                <th>Recording</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m._id}>
                  <td>{format(new Date(m.scheduledAt), 'MMM d, yyyy · HH:mm')}</td>
                  <td className={styles.cellName}>{displayCustomer(m)}</td>
                  <td>{m.title}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeMeeting}`}>
                      {m.status || 'schedule'}
                    </span>
                  </td>
                  <td>
                    {m.recordingStatus && m.recordingStatus !== 'none' ? (
                      <span className={`${styles.badge} badge-pending`}>
                        <Video size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                        {recordingLabel(m.recordingStatus)}
                      </span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    <Link
                      to={`/meetings/${m._id}`}
                      className={styles.iconBtn}
                      title="View meeting"
                      aria-label="View meeting"
                    >
                      <ExternalLink size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateMeetingModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={load}
      />
    </div>
  );
}
