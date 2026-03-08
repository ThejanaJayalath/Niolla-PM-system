import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, MessageSquare, Bell, ClipboardList, Users, FolderKanban, Banknote, Wallet, AlertCircle, CalendarClock } from 'lucide-react';
import { api } from '../api/client';
import styles from './Dashboard.module.css';

interface Stats {
  totalInquiries: number;
  newInquiries: number;
  upcomingReminders: number;
  proposalsCreated: number;
}

interface PaymentSummary {
  totalClients: number;
  totalProjectValue: number;
  totalCollected: number;
  pendingBalance: number;
  overdueCount: number;
  dueTodayCount: number;
}

interface ReminderRow {
  _id: string;
  inquiryId: string | { _id: string; customerName?: string };
  title: string;
  scheduledAt: string;
  type: string;
}

function getInquiryName(inq: ReminderRow['inquiryId']): string {
  if (!inq) return 'Unknown';
  if (typeof inq === 'object' && inq !== null && 'customerName' in inq)
    return (inq as { customerName?: string }).customerName || 'Inquiry';
  return 'Inquiry';
}

function getInquiryId(inq: ReminderRow['inquiryId']): string {
  if (!inq) return '';
  if (typeof inq === 'object' && inq !== null && '_id' in inq)
    return (inq as { _id: string })._id;
  return String(inq);
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalInquiries: 0,
    newInquiries: 0,
    upcomingReminders: 0,
    proposalsCreated: 0,
  });
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<unknown[]>('/inquiries'),
      api.get<ReminderRow[]>('/reminders/upcoming?limit=10'),
      api.get<unknown[]>('/proposals'),
      api.get<{ totalClients: number; totalProjectValue: number; totalCollected: number; pendingBalance: number; overdueCount: number; dueTodayCount: number }>('/reports/summary'),
    ]).then(([inqRes, remRes, propRes, summaryRes]) => {
      const inquiries = (inqRes.success && inqRes.data ? inqRes.data : []) as { status?: string }[];
      const total = inquiries.length;
      const newCount = inquiries.filter((i) => i.status === 'new').length;
      const proposals = (propRes.success && propRes.data ? propRes.data : []) as unknown[];
      setStats({
        totalInquiries: total,
        newInquiries: newCount,
        upcomingReminders: remRes.success && remRes.data ? remRes.data.length : 0,
        proposalsCreated: proposals.length,
      });
      if (remRes.success && remRes.data) setReminders(remRes.data);
      if (summaryRes.success && summaryRes.data) setPaymentSummary(summaryRes.data);
      else setPaymentSummary({ totalClients: 0, totalProjectValue: 0, totalCollected: 0, pendingBalance: 0, overdueCount: 0, dueTodayCount: 0 });
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 className={styles.pageTitle}>Dashboard</h1>
      <div className={styles.cardGrid}>
        <div className={styles.card}>
          <div className={styles.cardIcon}>
            <ClipboardList size={24} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Total Inquiries</span>
            <span className={styles.cardValue}>{loading ? '—' : stats.totalInquiries}</span>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon}>
            <MessageSquare size={24} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>New Inquiries</span>
            <span className={styles.cardValue}>{loading ? '—' : stats.newInquiries}</span>
          </div>
        </div>
        <div className={styles.card}>
          <Link to="/reminders" className={styles.cardLink}>
            <div className={styles.cardIcon}>
              <Bell size={24} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Upcoming Reminders</span>
              <span className={styles.cardValue}>{loading ? '—' : stats.upcomingReminders}</span>
            </div>
          </Link>
        </div>
        <div className={styles.card}>
          <Link to="/proposals" className={styles.cardLink}>
            <div className={styles.cardIcon}>
              <FileText size={24} />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>Proposals Created</span>
              <span className={styles.cardValue}>{loading ? '—' : stats.proposalsCreated}</span>
            </div>
          </Link>
        </div>
      </div>

      {paymentSummary !== null && (
        <>
          <h2 className={styles.sectionTitle} style={{ marginTop: '2rem', marginBottom: '1rem' }}>Payment overview</h2>
          <div className={styles.cardGrid}>
            <Link to="/customer" className={styles.cardLink}>
              <div className={styles.card}>
                <div className={styles.cardIcon}>
                  <Users size={24} />
                </div>
                <div className={styles.cardContent}>
                  <span className={styles.cardLabel}>Total clients</span>
                  <span className={styles.cardValue}>{loading ? '—' : paymentSummary.totalClients}</span>
                </div>
              </div>
            </Link>
            <div className={styles.card}>
              <div className={styles.cardIcon} style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
                <FolderKanban size={24} />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardLabel}>Total project value</span>
                <span className={styles.cardValue}>{loading ? '—' : `Rs. ${Number(paymentSummary.totalProjectValue).toLocaleString()}`}</span>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardIcon} style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>
                <Banknote size={24} />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardLabel}>Total collected</span>
                <span className={styles.cardValue}>{loading ? '—' : `Rs. ${Number(paymentSummary.totalCollected).toLocaleString()}`}</span>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardIcon} style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
                <Wallet size={24} />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardLabel}>Pending balance</span>
                <span className={styles.cardValue}>{loading ? '—' : `Rs. ${Number(paymentSummary.pendingBalance).toLocaleString()}`}</span>
              </div>
            </div>
            <Link to="/installments?status=overdue" className={styles.cardLink}>
              <div className={styles.card}>
                <div className={styles.cardIcon} style={{ background: '#fef2f2', color: '#dc2626' }}>
                  <AlertCircle size={24} />
                </div>
                <div className={styles.cardContent}>
                  <span className={styles.cardLabel}>Overdue installments</span>
                  <span className={styles.cardValue}>{loading ? '—' : paymentSummary.overdueCount}</span>
                </div>
              </div>
            </Link>
            <Link to="/installments" className={styles.cardLink}>
              <div className={styles.card}>
                <div className={styles.cardIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <CalendarClock size={24} />
                </div>
                <div className={styles.cardContent}>
                  <span className={styles.cardLabel}>Due today</span>
                  <span className={styles.cardValue}>{loading ? '—' : paymentSummary.dueTodayCount}</span>
                </div>
              </div>
            </Link>
          </div>
        </>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Upcoming Reminders</h2>
        </div>
        {loading ? (
          <p className={styles.muted}>Loading...</p>
        ) : reminders.length === 0 ? (
          <p className={styles.emptyText}>No upcoming reminders. Add them from an inquiry detail page.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Inquiry Name</th>
                  <th>Reminder Title</th>
                  <th>Date & Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <span className="font-medium">{getInquiryName(r.inquiryId)}</span>
                    </td>
                    <td>{r.title}</td>
                    <td>{format(new Date(r.scheduledAt), 'MMM d, yyyy · p')}</td>
                    <td>
                      <Link to={`/inquiries/${getInquiryId(r.inquiryId)}`} className={styles.viewLink}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
