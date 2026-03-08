import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check } from 'lucide-react';
import { api } from '../api/client';
import styles from './Reminders.module.css';

interface PaymentNotificationRow {
  _id: string;
  clientId: string;
  clientName?: string;
  installmentId?: string;
  installmentNo?: number;
  projectName?: string;
  type: string;
  triggerType: string;
  scheduledAt: string;
  sentAt?: string;
  status: string;
  messageBody?: string;
}

export default function PaymentNotifications() {
  const [notifications, setNotifications] = useState<PaymentNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [triggerFilter, setTriggerFilter] = useState<string>('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (triggerFilter) params.append('triggerType', triggerFilter);
    const q = params.toString() ? `?${params.toString()}` : '';
    api.get<PaymentNotificationRow[]>(`/payment-notifications${q}`).then((res) => {
      if (res.success && res.data) setNotifications(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [statusFilter, triggerFilter]);

  const markSent = async (id: string) => {
    setMarkingId(id);
    await api.patch(`/payment-notifications/${id}/sent`, {});
    setMarkingId(null);
    load();
  };

  const triggerLabel = (t: string) => {
    const map: Record<string, string> = {
      due_reminder: 'Due reminder',
      overdue: 'Overdue',
      receipt: 'Receipt',
    };
    return map[t] || t;
  };

  return (
    <div>
      <h1 className={styles.title}>Payment Notifications</h1>
      <p className={styles.muted}>Due reminders, overdue alerts, and payment receipts. Separate from inquiry Reminders.</p>
      <div className="flex gap-3 mb-4 mt-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All types</option>
          <option value="due_reminder">Due reminder</option>
          <option value="overdue">Overdue</option>
          <option value="receipt">Receipt</option>
        </select>
      </div>
      {loading ? (
        <p className={styles.muted}>Loading...</p>
      ) : notifications.length === 0 ? (
        <div className={styles.empty}>
          <p>No payment notifications.</p>
          <p className={styles.emptyHint}>They are created by the system for due/overdue installments or when payments are recorded.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Scheduled</th>
                <th>Client</th>
                <th>Project / Installment</th>
                <th>Type</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n._id}>
                  <td>{format(new Date(n.scheduledAt), 'MMM d, yyyy · HH:mm')}</td>
                  <td className={styles.cellName}>{n.clientName || n.clientId}</td>
                  <td>
                    {n.projectName || '—'}
                    {n.installmentNo != null ? ` #${n.installmentNo}` : ''}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeReminder}`}>{n.type}</span>
                  </td>
                  <td>{triggerLabel(n.triggerType)}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        n.status === 'sent' ? 'bg-green-100 text-green-800' : n.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {n.status}
                    </span>
                  </td>
                  <td>
                    {n.status === 'pending' && (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Mark as sent"
                        onClick={() => markSent(n._id)}
                        disabled={markingId === n._id}
                      >
                        <Check size={18} />
                      </button>
                    )}
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
