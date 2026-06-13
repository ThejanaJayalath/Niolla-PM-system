import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { api } from '../../api/client';
import { normalizeProjectStatus } from '../../types/projectLifecycle';
import styles from '../../pages/Dashboard.module.css';

interface ReminderRow {
  _id: string;
  inquiryId: string | { _id: string; customerName?: string };
  title: string;
  scheduledAt: string;
  type: string;
}

interface ProjectRow {
  _id: string;
  projectName: string;
  clientName?: string;
  status: string;
  assignedEmployees?: string[];
}

interface UserRow {
  _id: string;
  name: string;
}

function getInquiryName(inq: ReminderRow['inquiryId']): string {
  if (!inq) return 'Unknown';
  if (typeof inq === 'object' && inq !== null && 'customerName' in inq)
    return (inq as { customerName?: string }).customerName || 'Inquiry';
  return 'Inquiry';
}

type CustomerTab = 'all' | 'in_progress' | 'unassigned';

function statusPill(status: string): { label: string; className: string } {
  const s = normalizeProjectStatus(status);
  if (s === 'under_development') return { label: 'Active', className: styles.statusActive };
  if (s === 'unassigned') return { label: 'Pending', className: styles.statusPending };
  if (s === 'suspended') return { label: 'Lost', className: styles.statusLost };
  return { label: 'Completed', className: styles.statusPending };
}

export default function DashboardBottomPanels({ enabled }: { enabled: boolean }) {
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [meetings, setMeetings] = useState<ReminderRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderTab, setReminderTab] = useState<'reminders' | 'meetings'>('reminders');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('all');

  useEffect(() => {
    if (!enabled) return;
    Promise.all([
      api.get<ReminderRow[]>('/reminders/upcoming?limit=20&type=reminder'),
      api.get<ReminderRow[]>('/reminders/upcoming?limit=20&type=meeting'),
      api.get<ProjectRow[]>('/projects'),
      api.get<UserRow[]>('/users'),
    ]).then(([remRes, meetRes, projRes, userRes]) => {
      if (remRes.success && remRes.data) setReminders(remRes.data);
      if (meetRes.success && meetRes.data) setMeetings(meetRes.data);
      if (projRes.success && projRes.data) setProjects(projRes.data);
      if (userRes.success && userRes.data) setUsers(userRes.data);
      setLoading(false);
    });
  }, [enabled]);

  const userMap = useMemo(() => new Map(users.map((u) => [u._id, u.name])), [users]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const s = normalizeProjectStatus(p.status);
      if (customerTab === 'in_progress') return s === 'under_development';
      if (customerTab === 'unassigned') return s === 'unassigned';
      return true;
    });
  }, [projects, customerTab]);

  const inProgressCount = projects.filter((p) => normalizeProjectStatus(p.status) === 'under_development').length;
  const unassignedCount = projects.filter((p) => normalizeProjectStatus(p.status) === 'unassigned').length;

  if (!enabled) return null;

  const activeReminders = reminderTab === 'reminders' ? reminders : meetings;

  return (
    <div className={styles.bottomGrid}>
      <section className={styles.panelCard}>
        <h2 className={styles.panelCardTitle}>Reminders / Tasks Overview</h2>
        <div className={styles.tabBar}>
          <button
            type="button"
            className={reminderTab === 'reminders' ? styles.tabActive : styles.tab}
            onClick={() => setReminderTab('reminders')}
          >
            Pending Reminders ({reminders.length})
          </button>
          <button
            type="button"
            className={reminderTab === 'meetings' ? styles.tabActive : styles.tab}
            onClick={() => setReminderTab('meetings')}
          >
            Scheduled Meetings ({meetings.length})
          </button>
        </div>

        {loading ? (
          <p className={styles.panelMuted}>Loading...</p>
        ) : activeReminders.length === 0 ? (
          <div className={styles.emptyState}>
            <Clock size={48} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              No upcoming {reminderTab === 'reminders' ? 'reminders' : 'meetings'}.
            </p>
          </div>
        ) : (
          <ul className={styles.reminderList}>
            {activeReminders.map((r) => (
              <li key={r._id} className={styles.reminderItem}>
                <div>
                  <p className={styles.reminderTitle}>{r.title}</p>
                  <p className={styles.reminderMeta}>
                    {getInquiryName(r.inquiryId)} &middot; {format(new Date(r.scheduledAt), 'MMM d, yyyy � p')}
                  </p>
                </div>
                <Link to="/reminders" className={styles.reminderLink}>
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.panelCard}>
        <h2 className={styles.panelCardTitle}>Customers &amp; Assigned Staff</h2>
        <div className={styles.tabBar}>
          <button
            type="button"
            className={customerTab === 'all' ? styles.tabActive : styles.tab}
            onClick={() => setCustomerTab('all')}
          >
            All ({projects.length})
          </button>
          <button
            type="button"
            className={customerTab === 'in_progress' ? styles.tabActive : styles.tab}
            onClick={() => setCustomerTab('in_progress')}
          >
            In Progress ({inProgressCount})
          </button>
          <button
            type="button"
            className={customerTab === 'unassigned' ? styles.tabActive : styles.tab}
            onClick={() => setCustomerTab('unassigned')}
          >
            Unassigned ({unassignedCount})
          </button>
        </div>

        {loading ? (
          <p className={styles.panelMuted}>Loading...</p>
        ) : filteredProjects.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No customers or projects in this view.</p>
          </div>
        ) : (
          <div className={styles.customerTableWrap}>
            <table className={styles.customerTable}>
              <thead>
                <tr>
                  <th>Customer / Project Name</th>
                  <th>Assigned Manager (PM)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.slice(0, 8).map((p) => {
                  const pmId = p.assignedEmployees?.[0];
                  const pmName = pmId ? userMap.get(pmId) ?? 'Assigned' : 'Change Driver';
                  const pill = statusPill(p.status);
                  return (
                    <tr key={p._id}>
                      <td>
                        <div className={styles.customerCellPrimary}>{p.clientName || '-'}</div>
                        <div className={styles.customerCellSecondary}>{p.projectName}</div>
                      </td>
                      <td>
                        <span className={styles.pmSelect}>{pmName}</span>
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${pill.className}`}>{pill.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
