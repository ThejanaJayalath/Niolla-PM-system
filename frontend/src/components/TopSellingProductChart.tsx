import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, BarChart3, Package, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import styles from './TopSellingProductChart.module.css';

interface ProductSalesRow {
  productId: string;
  productCode: string;
  productName: string;
  salesVolume: number;
  revenueCollected: number;
}

interface ProductSalesHighlight {
  productId: string;
  productCode: string;
  productName: string;
  salesVolume: number;
  revenueCollected: number;
}

interface ProductSalesAnalytics {
  products: ProductSalesRow[];
  topByQuantity: ProductSalesHighlight | null;
  topByRevenue: ProductSalesHighlight | null;
}

const CHART_COLORS = ['#ea580c', '#0d9488', '#2563eb', '#7c3aed', '#db2777'];

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function MiniBarChart({
  data,
  formatValue,
  maxHeight = 100,
}: {
  data: { label: string; value: number; color: string }[];
  formatValue: (n: number) => string;
  maxHeight?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (data.every((d) => d.value <= 0)) {
    return <p className={styles.emptyChart}>No data yet — link customers to products.</p>;
  }
  return (
    <div className={styles.barChart} style={{ minHeight: maxHeight + 36 }}>
      {data.map((d) => {
        const h = Math.max(8, (d.value / max) * maxHeight);
        return (
          <div key={d.label} className={styles.barCol} title={`${d.label}: ${formatValue(d.value)}`}>
            <span className={styles.barValue}>{formatValue(d.value)}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ height: h, background: d.color }} />
            </div>
            <span className={styles.barLabel}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface TopSellingProductChartProps {
  enabled?: boolean;
}

export default function TopSellingProductChart({ enabled = true }: TopSellingProductChartProps) {
  const [analytics, setAnalytics] = useState<ProductSalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<ProductSalesAnalytics>('/products/sales/analytics')
      .then((res) => {
        if (!cancelled && res.success && res.data) setAnalytics(res.data);
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

  const products = analytics?.products ?? [];
  const volumeData = products
    .filter((p) => p.salesVolume > 0)
    .map((p, i) => ({
      label: p.productCode,
      value: p.salesVolume,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  const revenueData = products
    .filter((p) => p.revenueCollected > 0)
    .map((p, i) => ({
      label: p.productCode,
      value: p.revenueCollected,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <BarChart3 size={22} />
        </div>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Top selling products</h2>
          <p className={styles.subtitle}>Best performers by licenses sold and revenue collected</p>
        </div>
        <Link to="/products" className={styles.viewAll}>
          Product directory →
        </Link>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading sales chart…</p>
      ) : (
        <>
          <div className={styles.highlights}>
            <div className={`${styles.highlightCard} ${styles.highlightQty}`}>
              <Award size={20} className={styles.highlightIcon} />
              <div>
                <span className={styles.highlightLabel}>Top by quantity</span>
                {analytics?.topByQuantity ? (
                  <>
                    <p className={styles.highlightName}>{analytics.topByQuantity.productName}</p>
                    <p className={styles.highlightMeta}>
                      {analytics.topByQuantity.salesVolume} sold · {analytics.topByQuantity.productCode}
                    </p>
                  </>
                ) : (
                  <p className={styles.highlightEmpty}>No sales recorded</p>
                )}
              </div>
            </div>
            <div className={`${styles.highlightCard} ${styles.highlightRev}`}>
              <TrendingUp size={20} className={styles.highlightIcon} />
              <div>
                <span className={styles.highlightLabel}>Top by revenue</span>
                {analytics?.topByRevenue ? (
                  <>
                    <p className={styles.highlightName}>{analytics.topByRevenue.productName}</p>
                    <p className={styles.highlightMeta}>
                      {formatPrice(analytics.topByRevenue.revenueCollected)} · {analytics.topByRevenue.productCode}
                    </p>
                  </>
                ) : (
                  <p className={styles.highlightEmpty}>No payments linked yet</p>
                )}
              </div>
            </div>
          </div>

          <div className={styles.chartGrid}>
            <div className={styles.chartPanel}>
              <div className={styles.chartPanelHead}>
                <Package size={16} />
                <span>Sales volume (quantity)</span>
              </div>
              <MiniBarChart data={volumeData} formatValue={(n) => String(n)} />
            </div>
            <div className={styles.chartPanel}>
              <div className={styles.chartPanelHead}>
                <TrendingUp size={16} />
                <span>Revenue collected</span>
              </div>
              <MiniBarChart
                data={revenueData}
                formatValue={(n) =>
                  n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
                }
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
