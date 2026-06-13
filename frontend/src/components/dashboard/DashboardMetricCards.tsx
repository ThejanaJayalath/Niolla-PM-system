import type { ReactNode } from 'react';
import { ClipboardList, Users, Receipt, Banknote } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from '../../pages/Dashboard.module.css';

interface Props {
  totalInquiries: number;
  totalClients: number;
  pendingReceivables: number;
  totalCollected: number;
  inquiryTrend?: number;
  loading?: boolean;
}

function formatRs(amount: number): string {
  return `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trendLabel(pct: number | undefined, invert = false): string {
  if (pct === undefined || Number.isNaN(pct)) return '—';
  const effective = invert ? -pct : pct;
  const abs = Math.abs(effective).toFixed(1);
  if (effective > 0) return `${abs}% increase`;
  if (effective < 0) return `${abs}% decrease`;
  return 'No change';
}

function trendBarWidth(pct: number | undefined): number {
  if (pct === undefined || Number.isNaN(pct)) return 45;
  return Math.min(100, Math.max(12, 50 + pct));
}

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: number;
  trendInvert?: boolean;
  barColor?: string;
  to?: string;
}

function MetricCard({ icon, label, value, trend, trendInvert, barColor, to }: MetricCardProps) {
  const content = (
    <>
      <div className={styles.metricIcon}>{icon}</div>
      <div className={styles.metricBody}>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricValue}>{value}</span>
        <span className={styles.metricTrend}>{trendLabel(trend, trendInvert)}</span>
        <div className={styles.metricBarTrack}>
          <div
            className={styles.metricBarFill}
            style={{ width: `${trendBarWidth(trend)}%`, background: barColor ?? '#FF7A00' }}
          />
        </div>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${styles.metricCard} ${styles.metricCardLink}`}>
        {content}
      </Link>
    );
  }

  return <div className={styles.metricCard}>{content}</div>;
}

export default function DashboardMetricCards({
  totalInquiries,
  totalClients,
  pendingReceivables,
  totalCollected,
  inquiryTrend,
  loading,
}: Props) {
  const dash = loading ? '—' : undefined;

  return (
    <div className={styles.metricGrid}>
      <MetricCard
        icon={<ClipboardList size={22} />}
        label="Total Inquiries"
        value={dash ?? String(totalInquiries)}
        trend={inquiryTrend ?? 8.5}
        to="/inquiries"
      />
      <MetricCard
        icon={<Users size={22} />}
        label="Total Customers"
        value={dash ?? String(totalClients)}
        trend={12.3}
        to="/customer"
      />
      <MetricCard
        icon={<Receipt size={22} />}
        label="Pending Receivables"
        value={dash ?? formatRs(pendingReceivables)}
        trend={-5.2}
        trendInvert
        barColor="#F59E0B"
        to="/invoices?status=pending"
      />
      <MetricCard
        icon={<Banknote size={22} />}
        label="Total Collected"
        value={dash ?? formatRs(totalCollected)}
        trend={15.7}
        barColor="#FF7A00"
      />
    </div>
  );
}
