import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Medal, Trophy } from 'lucide-react';
import { api } from '../api/client';
import styles from './TopSellingProductChart.module.css';

interface LeaderboardRow {
  rank: number;
  productId: string;
  productCode: string;
  productName: string;
  salesVolume: number;
  revenueCollected: number;
  netProfit: number;
}

interface LeaderboardData {
  updatedAt: string;
  rows: LeaderboardRow[];
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface TopProductsLeaderboardProps {
  enabled?: boolean;
}

export default function TopProductsLeaderboard({ enabled = true }: TopProductsLeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<LeaderboardData>('/reports/products/top-leaderboard')
      .then((res) => {
        if (!cancelled && res.success && res.data) setData(res.data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return null;

  const rows = data?.rows ?? [];

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Trophy size={22} />
        </div>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Top products</h2>
          <p className={styles.subtitle}>Real-time sales leaderboard by revenue and active customers</p>
        </div>
        <Link to="/reports" className={styles.viewAll}>
          Product reports →
        </Link>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading leaderboard…</p>
      ) : rows.length === 0 ? (
        <p className={styles.loading}>No product sales yet — link customers to products in the directory.</p>
      ) : (
        <div className={styles.leaderboardWrap}>
          <table className={styles.leaderboardTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Active users</th>
                <th>Revenue</th>
                <th>Net profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row) => (
                <tr key={row.productId}>
                  <td>
                    <span className={styles.rankBadge}>
                      {row.rank <= 3 ? <Medal size={14} /> : null}
                      {row.rank}
                    </span>
                  </td>
                  <td>
                    <span className={styles.leaderProductName}>{row.productName}</span>
                    <span className={styles.leaderCode}>{row.productCode}</span>
                  </td>
                  <td>{row.salesVolume}</td>
                  <td className={styles.leaderRevenue}>{formatPrice(row.revenueCollected)}</td>
                  <td
                    className={row.netProfit >= 0 ? styles.leaderProfitPos : styles.leaderProfitNeg}
                  >
                    {formatPrice(row.netProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
