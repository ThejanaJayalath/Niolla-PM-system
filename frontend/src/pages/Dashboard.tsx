import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Wallet, PiggyBank, TrendingUp, Wrench } from 'lucide-react';
import { api } from '../api/client';
import { pushSystemToast } from '../lib/systemToast';
import { useAuth } from '../context/AuthContext';
import {
  canAccessLeadsAndBilling,
  canViewCompanyFinancials,
  canViewPaymentOverview,
} from '../lib/roles';
import CrmEngagementSection from '../components/CrmEngagementSection';
import TopProductsLeaderboard from '../components/TopProductsLeaderboard';
import TopSellingProductChart from '../components/TopSellingProductChart';
import DashboardWelcomeHero from '../components/dashboard/DashboardWelcomeHero';
import DashboardMetricCards from '../components/dashboard/DashboardMetricCards';
import DashboardActiveProjects from '../components/dashboard/DashboardActiveProjects';
import DashboardCharts from '../components/dashboard/DashboardCharts';
import DashboardBottomPanels from '../components/dashboard/DashboardBottomPanels';
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
  accountsReceivablePending: number;
  pendingBalance: number;
  overdueCount: number;
  dueTodayCount: number;
}

interface LiveBusinessBalanceRow {
  key: 'totalRevenue' | 'pendingReceivables' | 'totalExpenses' | 'netProfit' | 'finalProfit';
  category: string;
  description: string;
  amount: number;
}

interface LiveBusinessBalance {
  rows: LiveBusinessBalanceRow[];
  totalRevenue: number;
  pendingReceivables: number;
  totalExpenses: number;
  netProfit: number;
  finalProfit: number;
  expenseBreakdown: { marketing: number; payouts: number; overheads: number };
}

type PayoutReleaseStatus = 'accruing' | 'submitted' | 'released';

interface DeveloperWalletTransactionRow {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  displayStatus: 'Pending' | 'Available';
  walletStatus?: 'Pending' | 'Available';
  amount: number;
}

interface DeveloperPendingEarningsItem {
  projectId: string;
  projectName: string;
  amount: number;
  releaseStatus: PayoutReleaseStatus;
  proposalId?: string | null;
}

interface DeveloperPendingEarnings {
  totalPending: number;
  availableWalletBalance: number;
  totalEarnedThisMonth: number;
  totalEarnedThisYear: number;
  /** @deprecated Use staffAssignments (Staff_Assignments). */
  items: DeveloperPendingEarningsItem[];
  /** @deprecated Use wallet.ledger (Wallet collection). */
  transactions: DeveloperWalletTransactionRow[];
  wallet: { availableBalance: number; ledger: DeveloperWalletTransactionRow[] };
  staffAssignments: DeveloperPendingEarningsItem[];
}

interface PendingPayoutApprovalRow {
  projectId: string;
  projectName: string;
  developerId: string;
  developerName: string;
  developerEmail?: string;
  amount: number;
}

interface WorkerUpdateAssignment {
  _id?: string;
  ticketId: string;
  title: string;
  description?: string;
  status: string;
  projectRef: string;
  projectName?: string;
  productName?: string;
  workerPayoutValue?: number;
  developerPayoutValue?: number;
}

interface PendingUpdateReviewRow {
  _id?: string;
  ticketId: string;
  title: string;
  projectRef: string;
  projectName?: string;
  workerPayoutValue?: number;
  developerPayoutValue?: number;
  completedByWorkerName?: string;
  workerSubmittedAt?: string;
}

function releaseStatusLabel(s: PayoutReleaseStatus): string {
  if (s === 'submitted') return 'Awaiting admin approval';
  if (s === 'released') return 'Credited to wallet';
  return 'In progress';
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalInquiries: 0,
    newInquiries: 0,
    upcomingReminders: 0,
    proposalsCreated: 0,
  });
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [liveBalance, setLiveBalance] = useState<LiveBusinessBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingEarnings, setPendingEarnings] = useState<DeveloperPendingEarnings | null>(null);
  const [pendingEarningsLoading, setPendingEarningsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingPayoutApprovalRow[]>([]);
  const [pendingApprovalsLoading, setPendingApprovalsLoading] = useState(false);
  const [approveKey, setApproveKey] = useState<string | null>(null);
  const [markCompleteProjectId, setMarkCompleteProjectId] = useState<string | null>(null);
  const [updateAssignments, setUpdateAssignments] = useState<WorkerUpdateAssignment[]>([]);
  const [updateAssignmentsLoading, setUpdateAssignmentsLoading] = useState(false);
  const [completingUpdateId, setCompletingUpdateId] = useState<string | null>(null);
  const [pendingUpdateReviews, setPendingUpdateReviews] = useState<PendingUpdateReviewRow[]>([]);
  const [pendingUpdateReviewsLoading, setPendingUpdateReviewsLoading] = useState(false);
  const [approvingUpdateId, setApprovingUpdateId] = useState<string | null>(null);

  useEffect(() => {
    const showPaymentOverview = canViewPaymentOverview(user?.role);
    const showCompanyFinancials = canViewCompanyFinancials(user?.role);
    Promise.all([
      canAccessLeadsAndBilling(user?.role) ? api.get<unknown[]>('/inquiries') : Promise.resolve({ success: true, data: [] }),
      canAccessLeadsAndBilling(user?.role) ? api.get<unknown[]>('/proposals') : Promise.resolve({ success: true, data: [] }),
      showPaymentOverview
        ? api.get<PaymentSummary>('/reports/summary')
        : Promise.resolve({ success: false as const, data: undefined }),
      showCompanyFinancials
        ? api.get<LiveBusinessBalance>('/reports/live-business-balance')
        : Promise.resolve({ success: false as const, data: undefined }),
    ]).then(([inqRes, propRes, summaryRes, balanceRes]) => {
      const inquiries = (inqRes.success && inqRes.data ? inqRes.data : []) as { status?: string }[];
      const total = inquiries.length;
      const newCount = inquiries.filter((i) => i.status === 'new').length;
      const proposals = (propRes.success && propRes.data ? propRes.data : []) as unknown[];
      setStats({
        totalInquiries: total,
        newInquiries: newCount,
        upcomingReminders: 0,
        proposalsCreated: proposals.length,
      });
      if (summaryRes.success && summaryRes.data) setPaymentSummary(summaryRes.data);
      else
        setPaymentSummary({
          totalClients: 0,
          totalProjectValue: 0,
          totalCollected: 0,
          accountsReceivablePending: 0,
          pendingBalance: 0,
          overdueCount: 0,
          dueTodayCount: 0,
        });
      if (balanceRes.success && balanceRes.data) setLiveBalance(balanceRes.data);
      else setLiveBalance(null);
      setLoading(false);
    });
  }, [user?.role]);

  useEffect(() => {
    if (authLoading || user?.role !== 'employee') {
      if (!authLoading && user?.role !== 'employee') setPendingEarnings(null);
      return;
    }
    setPendingEarningsLoading(true);
    Promise.all([
      api.get<DeveloperPendingEarnings>('/projects/developer/pending-earnings'),
      api.get<{ availableBalance: number; ledger: DeveloperWalletTransactionRow[] }>('/projects/developer/wallet'),
      api.get<DeveloperPendingEarningsItem[]>('/projects/developer/staff-assignments'),
    ])
      .then(([summaryRes, walletRes, staffRes]) => {
        if (summaryRes.success && summaryRes.data) {
          const d = summaryRes.data;
          const wallet = walletRes.success && walletRes.data ? walletRes.data : d.wallet;
          const staffAssignments =
            staffRes.success && staffRes.data ? staffRes.data : d.staffAssignments ?? d.items;
          setPendingEarnings({
            ...d,
            wallet: wallet ?? { availableBalance: d.availableWalletBalance, ledger: d.transactions },
            staffAssignments: staffAssignments ?? d.items,
            items: staffAssignments ?? d.items,
            transactions: wallet?.ledger ?? d.transactions,
          });
        } else
          setPendingEarnings({
            totalPending: 0,
            availableWalletBalance: 0,
            totalEarnedThisMonth: 0,
            totalEarnedThisYear: 0,
            items: [],
            transactions: [],
            wallet: { availableBalance: 0, ledger: [] },
            staffAssignments: [],
          });
      })
      .finally(() => setPendingEarningsLoading(false));
  }, [authLoading, user?.role, user?._id]);

  useEffect(() => {
    if (authLoading || user?.role !== 'employee') {
      if (!authLoading && user?.role !== 'employee') setUpdateAssignments([]);
      return;
    }
    setUpdateAssignmentsLoading(true);
    api
      .get<WorkerUpdateAssignment[]>('/update-tickets/my-assignments')
      .then((res) => {
        if (res.success && res.data) setUpdateAssignments(res.data);
        else setUpdateAssignments([]);
      })
      .finally(() => setUpdateAssignmentsLoading(false));
  }, [authLoading, user?.role, user?._id]);

  useEffect(() => {
    if (authLoading || (user?.role !== 'owner' && user?.role !== 'pm')) {
      if (!authLoading && user?.role !== 'owner' && user?.role !== 'pm') setPendingApprovals([]);
      return;
    }
    setPendingApprovalsLoading(true);
    api
      .get<PendingPayoutApprovalRow[]>('/projects/admin/pending-payout-approvals')
      .then((res) => {
        if (res.success && res.data) setPendingApprovals(res.data);
        else setPendingApprovals([]);
      })
      .finally(() => setPendingApprovalsLoading(false));
  }, [authLoading, user?.role]);

  useEffect(() => {
    if (authLoading || (user?.role !== 'owner' && user?.role !== 'pm')) {
      if (!authLoading && user?.role !== 'owner' && user?.role !== 'pm') setPendingUpdateReviews([]);
      return;
    }
    setPendingUpdateReviewsLoading(true);
    api
      .get<PendingUpdateReviewRow[]>('/update-tickets/pending-review')
      .then((res) => {
        if (res.success && res.data) setPendingUpdateReviews(res.data);
        else setPendingUpdateReviews([]);
      })
      .finally(() => setPendingUpdateReviewsLoading(false));
  }, [authLoading, user?.role]);

  const markTaskCompleted = async (projectId: string) => {
    setMarkCompleteProjectId(projectId);
    const res = await api.post(`/projects/${projectId}/payout-completion/submit`, {});
    setMarkCompleteProjectId(null);
    if (res.success) {
      const [summaryRes, walletRes, staffRes] = await Promise.all([
        api.get<DeveloperPendingEarnings>('/projects/developer/pending-earnings'),
        api.get<{ availableBalance: number; ledger: DeveloperWalletTransactionRow[] }>('/projects/developer/wallet'),
        api.get<DeveloperPendingEarningsItem[]>('/projects/developer/staff-assignments'),
      ]);
      if (summaryRes.success && summaryRes.data) {
        const d = summaryRes.data;
        const wallet = walletRes.success && walletRes.data ? walletRes.data : d.wallet;
        const staffAssignments =
          staffRes.success && staffRes.data ? staffRes.data : d.staffAssignments ?? d.items;
        setPendingEarnings({
          ...d,
          wallet: wallet ?? { availableBalance: d.availableWalletBalance, ledger: d.transactions },
          staffAssignments: staffAssignments ?? d.items,
          items: staffAssignments ?? d.items,
          transactions: wallet?.ledger ?? d.transactions,
        });
      }
      pushSystemToast('A notification was sent to the Admin for approval.', 'success');
    } else {
      pushSystemToast(res.error?.message ?? 'Could not mark as completed.', 'error');
    }
  };

  const viewProposalPdf = (proposalId: string, projectName: string) => {
    const safe = projectName.replace(/\s+/g, '-').slice(0, 60) || 'proposal';
    api.download(`/proposals/${proposalId}/pdf`, `proposal-${safe}.pdf`).catch((err) => {
      pushSystemToast(err instanceof Error ? err.message : 'Could not open proposal PDF', 'error');
    });
  };

  const completeUpdateAssignment = async (ticketId: string) => {
    setCompletingUpdateId(ticketId);
    const res = await api.patch(`/update-tickets/${ticketId}/worker-complete`, {});
    setCompletingUpdateId(null);
    if (res.success) {
      setUpdateAssignments((prev) => prev.filter((t) => t._id !== ticketId));
      pushSystemToast('Submitted for admin review. You will be notified when approved.', 'success');
    } else {
      pushSystemToast(res.error?.message ?? 'Could not complete update.', 'error');
    }
  };

  const approveUpdateFromDashboard = async (ticketId: string) => {
    setApprovingUpdateId(ticketId);
    const res = await api.patch(`/update-tickets/${ticketId}/approve-completion`, {});
    setApprovingUpdateId(null);
    if (res.success) {
      setPendingUpdateReviews((prev) => prev.filter((t) => t._id !== ticketId));
      pushSystemToast('Update approved — worker payout credited and customer notified.', 'success');
    } else {
      pushSystemToast(res.error?.message ?? 'Could not approve update.', 'error');
    }
  };

  const approvePayoutFromDashboard = async (projectId: string, developerId: string) => {
    const key = `${projectId}:${developerId}`;
    setApproveKey(key);
    const res = await api.post(`/projects/${projectId}/payout-completion/approve`, { developerId });
    setApproveKey(null);
    if (res.success) {
      const list = await api.get<PendingPayoutApprovalRow[]>('/projects/admin/pending-payout-approvals');
      if (list.success && list.data) setPendingApprovals(list.data);
    }
  };

  const showLeadsDashboard = canAccessLeadsAndBilling(user?.role);
  const showFinancials = canViewCompanyFinancials(user?.role);
  const showPayments = canViewPaymentOverview(user?.role);

  return (
    <div className={styles.dashboard}>

      {user?.role === 'employee' && (
        <section className={styles.devWalletSection}>
          <div className={styles.walletHero}>
            <div className={styles.walletHeading}>
              <h2 className={styles.walletTitle}>Main Wallet Overview</h2>
              <p className={styles.walletSubtitle}>
                Track pending earnings, approved balance, and growth at a glance.
              </p>
            </div>
          </div>
          <div className={styles.walletCards}>
            <div className={`${styles.card} ${styles.walletCard}`}>
              <div className={styles.cardIcon} style={{ background: '#ecfdf5', color: '#047857' }}>
                <PiggyBank size={24} />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardLabel}>Pending Earnings</span>
                <span className={styles.cardValue}>
                  {pendingEarningsLoading || !pendingEarnings
                    ? '—'
                    : `LKR ${Number(pendingEarnings.totalPending).toLocaleString()}`}
                </span>
                <p className={styles.cardHelpText}>
                  Money allocated to active projects but not yet approved by the Admin.
                </p>
              </div>
            </div>
            <div className={`${styles.card} ${styles.walletCard}`}>
              <div className={styles.cardIcon} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                <Wallet size={24} />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardLabel}>Available Balance</span>
                <span className={styles.cardValue}>
                  {pendingEarningsLoading || !pendingEarnings
                    ? '—'
                    : `LKR ${Number(pendingEarnings.availableWalletBalance).toLocaleString()}`}
                </span>
                <p className={styles.cardHelpText}>
                  Money from approved tasks that is ready for the monthly payout.
                </p>
              </div>
            </div>
            <div className={`${styles.card} ${styles.walletCard}`}>
              <div className={styles.cardIcon} style={{ background: '#fef3c7', color: '#b45309' }}>
                <TrendingUp size={24} />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardLabel}>Total Earned</span>
                <span className={styles.cardValue}>
                  {pendingEarningsLoading || !pendingEarnings
                    ? '—'
                    : `LKR ${Number(pendingEarnings.totalEarnedThisMonth).toLocaleString()}`}
                </span>
                <span className={styles.cardSubValue}>
                  {!pendingEarningsLoading && pendingEarnings
                    ? `Year to date: LKR ${Number(pendingEarnings.totalEarnedThisYear).toLocaleString()}`
                    : ''}
                </span>
                <p className={styles.cardHelpText}>
                  Total amount credited after admin approval this month (and year to date above).
                </p>
              </div>
            </div>
          </div>

          <h3 className={styles.sectionTitle} style={{ marginTop: '1.75rem', marginBottom: '0.5rem', fontSize: '1rem' }}>
            Update Tasks
          </h3>
          {updateAssignmentsLoading ? (
            <p className={styles.muted} style={{ textAlign: 'left', padding: '0.5rem 0' }}>
              Loading…
            </p>
          ) : updateAssignments.length === 0 ? (
            <p className={styles.muted} style={{ textAlign: 'left', padding: '0.5rem 0' }}>
              No customer update tasks assigned to you right now.
            </p>
          ) : (
            <div className={styles.devProjectGrid}>
              {updateAssignments.map((row) => {
                const busy = completingUpdateId === row._id;
                const payout = row.workerPayoutValue ?? row.developerPayoutValue;
                return (
                  <div key={row._id ?? row.ticketId} className={styles.devProjectCard}>
                    <div className={styles.devInlineMuted} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Wrench size={14} />
                      {row.ticketId}
                    </div>
                    <h4 className={styles.devProjectTitle}>{row.title}</h4>
                    {row.description ? (
                      <p className={styles.devInlineMuted} style={{ marginTop: '0.35rem' }}>
                        {row.description}
                      </p>
                    ) : null}
                    <div className={styles.devProjectPayout} style={{ marginTop: '0.5rem' }}>
                      {row.projectName ? (
                        <>
                          Project: <strong>{row.projectName}</strong>
                          {row.productName ? ` · ${row.productName}` : ''}
                        </>
                      ) : null}
                    </div>
                    {payout != null && Number(payout) > 0 ? (
                      <div className={styles.devProjectPayout}>
                        Your payout: <strong>LKR {Number(payout).toLocaleString()}</strong>
                      </div>
                    ) : null}
                    <div className={styles.devInlineMuted}>{row.status.replace('_', ' ')}</div>
                    <div className={styles.devProjectActions}>
                      {row.projectRef ? (
                        <Link to={`/projects/${row.projectRef}`} className={styles.viewLink}>
                          Open project
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className={styles.devBtnPrimary}
                        disabled={!!completingUpdateId || !row._id}
                        onClick={() => row._id && void completeUpdateAssignment(row._id)}
                      >
                        {busy ? 'Submitting…' : 'Task Completed'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h3 className={styles.sectionTitle} style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem' }}>
            Your projects
          </h3>
          {pendingEarningsLoading ? (
            <p className={styles.muted} style={{ textAlign: 'left', padding: '0.5rem 0' }}>
              Loading…
            </p>
          ) : !pendingEarnings || pendingEarnings.staffAssignments.length === 0 ? (
            <p className={styles.muted} style={{ textAlign: 'left', padding: '0.5rem 0' }}>
              No active assignments with a payout yet.
            </p>
          ) : (
            <div className={styles.devProjectGrid}>
              {pendingEarnings.staffAssignments.map((row) => {
                const busy = markCompleteProjectId === row.projectId;
                const canMarkComplete = row.releaseStatus === 'accruing';
                return (
                  <div key={row.projectId} className={styles.devProjectCard}>
                    <h4 className={styles.devProjectTitle}>{row.projectName}</h4>
                    <div className={styles.devProjectPayout}>
                      Assigned payout:{' '}
                      <strong>LKR {Number(row.amount).toLocaleString()}</strong>
                    </div>
                    <div className={styles.devInlineMuted}>{releaseStatusLabel(row.releaseStatus ?? 'accruing')}</div>
                    <div className={styles.devProjectActions}>
                      <button
                        type="button"
                        className={styles.devBtnSecondary}
                        disabled={!row.proposalId}
                        onClick={() => row.proposalId && viewProposalPdf(row.proposalId, row.projectName)}
                      >
                        View Proposal
                      </button>
                      <button
                        type="button"
                        className={styles.devBtnPrimary}
                        disabled={!canMarkComplete || !!markCompleteProjectId}
                        title={
                          canMarkComplete
                            ? 'Once clicked, a notification is sent to Admin for approval.'
                            : releaseStatusLabel(row.releaseStatus ?? 'accruing')
                        }
                        aria-label={
                          canMarkComplete
                            ? 'Mark as Completed. Once clicked, a notification is sent to Admin for approval.'
                            : `Mark as Completed (unavailable): ${releaseStatusLabel(row.releaseStatus ?? 'accruing')}`
                        }
                        onClick={() => markTaskCompleted(row.projectId)}
                      >
                        {busy ? 'Submitting…' : 'Mark as Completed'}
                      </button>
                      <Link to={`/projects/${row.projectId}?tab=assignments`} className={styles.viewLink}>
                        Details
                      </Link>
                    </div>
                    {!row.proposalId ? (
                      <p className={styles.devInlineMuted}>Proposal PDF unavailable (link your customer to an inquiry).</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <h3 className={styles.sectionTitle} style={{ marginTop: '1.75rem', marginBottom: '0.5rem', fontSize: '1rem' }}>
            Transaction history
          </h3>
          {!pendingEarningsLoading && pendingEarnings && pendingEarnings.wallet.ledger.length > 0 ? (
            <div className={styles.transactionTableCard}>
              <div className={styles.transactionTableScroll}>
                <table className={styles.transactionGridTable}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEarnings.wallet.ledger.map((t) => (
                      <tr key={t.id}>
                        <td>{format(new Date(t.date), 'yyyy-MM-dd')}</td>
                        <td className={styles.transactionCellStrong}>{t.projectName}</td>
                        <td>{t.displayStatus}</td>
                        <td>LKR {Number(t.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className={styles.muted} style={{ textAlign: 'left', padding: '0.5rem 0' }}>
              No payout submissions yet. Mark a project complete to appear here.
            </p>
          )}
        </section>
      )}

      {showLeadsDashboard && (
        <>
          <DashboardWelcomeHero userName={user?.name} />
          <DashboardMetricCards
            totalInquiries={stats.totalInquiries}
            totalClients={paymentSummary?.totalClients ?? 0}
            pendingReceivables={paymentSummary?.accountsReceivablePending ?? 0}
            totalCollected={paymentSummary?.totalCollected ?? 0}
            loading={loading}
          />
          <DashboardActiveProjects />
          <DashboardCharts enabled={showPayments} />
          <DashboardBottomPanels enabled />
        </>
      )}

      {showFinancials && (
        <div className={styles.secondarySection}>
          <TopProductsLeaderboard enabled />
          <TopSellingProductChart enabled />
        </div>
      )}

      {(user?.role === 'owner' || user?.role === 'pm') && (
        <section className={styles.approvalSection}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '0.75rem' }}>
            Update reviews awaiting approval
          </h2>
          {pendingUpdateReviewsLoading ? (
            <p className={styles.muted}>Loading…</p>
          ) : pendingUpdateReviews.length === 0 ? (
            <p className={styles.muted}>No completed updates waiting for your review.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Project</th>
                    <th>Worker</th>
                    <th>Payout</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUpdateReviews.map((row) => {
                    const busy = approvingUpdateId === row._id;
                    const payout = row.workerPayoutValue ?? row.developerPayoutValue;
                    return (
                      <tr key={row._id ?? row.ticketId}>
                        <td>
                          <div className="font-medium">{row.ticketId}</div>
                          <div className={styles.muted} style={{ fontSize: '0.85rem' }}>
                            {row.title}
                          </div>
                        </td>
                        <td className="font-medium">{row.projectName || '—'}</td>
                        <td>{row.completedByWorkerName || '—'}</td>
                        <td>{payout != null && payout > 0 ? `Rs. ${Number(payout).toLocaleString()}` : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={!!approvingUpdateId || !row._id}
                              onClick={() => row._id && void approveUpdateFromDashboard(row._id)}
                              className={styles.viewLink}
                              style={{
                                cursor: approvingUpdateId ? 'not-allowed' : 'pointer',
                                border: '1px solid #16a34a',
                                borderRadius: '6px',
                                padding: '0.25rem 0.5rem',
                                background: '#f0fdf4',
                                color: '#15803d',
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                              }}
                            >
                              {busy ? 'Approving…' : 'Approve'}
                            </button>
                            <Link to="/update-tickets?status=PENDING_REVIEW" className={styles.viewLink}>
                              All updates
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {(user?.role === 'owner' || user?.role === 'pm') && (
        <section className={styles.approvalSection}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '0.75rem' }}>
            Developer payout approvals
          </h2>
          {pendingApprovalsLoading ? (
            <p className={styles.muted}>Loading…</p>
          ) : pendingApprovals.length === 0 ? (
            <p className={styles.muted}>No developers are waiting for payout approval.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Developer</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map((row) => {
                    const busy = approveKey === `${row.projectId}:${row.developerId}`;
                    return (
                      <tr key={`${row.projectId}-${row.developerId}`}>
                        <td className="font-medium">{row.projectName}</td>
                        <td>
                          {row.developerName}
                          {row.developerEmail ? (
                            <span className={styles.muted} style={{ display: 'block', fontSize: '0.8rem' }}>
                              {row.developerEmail}
                            </span>
                          ) : null}
                        </td>
                        <td>Rs. {Number(row.amount).toLocaleString()}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={!!approveKey}
                              onClick={() => approvePayoutFromDashboard(row.projectId, row.developerId)}
                              className={styles.viewLink}
                              style={{
                                cursor: approveKey ? 'not-allowed' : 'pointer',
                                border: '1px solid #16a34a',
                                borderRadius: '6px',
                                padding: '0.25rem 0.5rem',
                                background: '#f0fdf4',
                                color: '#15803d',
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                              }}
                            >
                              {busy ? 'Approving…' : 'Approve — credit wallet'}
                            </button>
                            <Link to={`/projects/${row.projectId}?tab=assignments`} className={styles.viewLink}>
                              Project
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {liveBalance && showFinancials && (
        <section className={styles.financeSection}>
          <div className={styles.financeSectionHeader}>
            <div className={styles.financeSectionIcon}>
              <TrendingUp size={22} />
            </div>
            <div>
              <h2 className={styles.sectionTitle}>Live Business Balance</h2>
              <p className={styles.financeIntro}>
                Self-accounting master ledger — updates when invoices are marked paid, developer payouts are
                assigned, and expenses are logged. Final Profit is shown after Marketing, Salaries, and
                Infrastructure are deducted.
              </p>
            </div>
          </div>
          <div className={styles.balanceTableWrap}>
            <table className={styles.balanceTable}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className={styles.balanceAmountCol}>Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {liveBalance.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={
                      row.key === 'finalProfit' || row.key === 'netProfit'
                        ? styles.balanceRowProfit
                        : row.key === 'totalExpenses'
                          ? styles.balanceRowExpense
                          : undefined
                    }
                  >
                    <td>
                      <div className={styles.balanceCategory}>{row.category}</div>
                      <p className={styles.balanceDesc}>{row.description}</p>
                    </td>
                    <td className={styles.balanceAmountCol}>
                      <span
                        className={
                          row.key === 'finalProfit' || row.key === 'netProfit'
                            ? row.amount >= 0
                              ? styles.balancePositive
                              : styles.balanceNegative
                            : undefined
                        }
                      >
                        {loading ? '—' : Number(row.amount).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.financeFootnote}>
            Expense breakdown — Marketing Rs. {liveBalance.expenseBreakdown.marketing.toLocaleString()} · Payouts Rs.{' '}
            {liveBalance.expenseBreakdown.payouts.toLocaleString()} · Overheads Rs.{' '}
            {liveBalance.expenseBreakdown.overheads.toLocaleString()}.{' '}
            <Link to="/transactions" className={styles.financeLink}>
              Open master ledger
            </Link>
          </p>
        </section>
      )}

      {showLeadsDashboard && <CrmEngagementSection enabled />}

    </div>
  );
}
