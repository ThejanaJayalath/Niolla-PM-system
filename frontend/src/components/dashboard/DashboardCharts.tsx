import { useEffect, useMemo, useState } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { api } from '../../api/client';
import styles from '../../pages/Dashboard.module.css';

interface TransactionsReport {
  entries: { date: string; kind: 'income' | 'expense'; amount: number }[];
}

interface InquiryRow {
  createdAt: string;
}

interface DayPoint {
  label: string;
  value: number;
  key: string;
}

function buildDaySeries(from: Date, to: Date, values: Map<string, number>): DayPoint[] {
  const days = eachDayOfInterval({ start: from, end: to });
  return days.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    return { key, label: format(d, 'MMM d'), value: values.get(key) ?? 0 };
  });
}

function aggregateByDay(
  items: { date: string; amount?: number }[],
  from: Date,
  to: Date,
  sumAmount = false
): DayPoint[] {
  const days = eachDayOfInterval({ start: from, end: to });
  const map = new Map(days.map((d) => [format(d, 'yyyy-MM-dd'), 0]));
  for (const item of items) {
    const key = format(new Date(item.date), 'yyyy-MM-dd');
    if (!map.has(key)) continue;
    map.set(key, (map.get(key) ?? 0) + (sumAmount ? Number(item.amount ?? 1) : 1));
  }
  return buildDaySeries(from, to, map);
}

function BarChart({ data, formatValue }: { data: DayPoint[]; formatValue: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return <p className={styles.chartEmpty}>No collection data in this period.</p>;
  }

  return (
    <div className={styles.barChartRow}>
      {data.map((d, i) => {
        const h = Math.max(6, (d.value / max) * 100);
        const shade = `rgba(255, 122, 0, ${0.45 + (i % 3) * 0.18})`;
        return (
          <div key={d.key} className={styles.barChartCol} title={`${d.label}: ${formatValue(d.value)}`}>
            <div className={styles.barChartTrack}>
              <div className={styles.barChartFill} style={{ height: `${h}%`, background: shade }} />
            </div>
            <span className={styles.barChartLabel}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const hasData = data.some((d) => d.value > 0);
  const w = 100;
  const h = 60;
  const pad = 4;

  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (d.value / max) * (h - pad * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? w},${h} L${points[0]?.x ?? 0},${h} Z`;

  if (!hasData) {
    return <p className={styles.chartEmpty}>No inquiries in this period.</p>;
  }

  return (
    <div className={styles.lineChartWrap}>
      <p className={styles.lineChartTotal}>
        <span className={styles.lineChartTotalValue}>{total.toFixed(0)}</span>
        <span className={styles.lineChartTotalLabel}> Total Inquiries</span>
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className={styles.lineChartSvg} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF7A00" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#lineArea)" />
        <path d={linePath} fill="none" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={data[i].key} cx={p.x} cy={p.y} r="1.8" fill="#FF7A00" />
        ))}
      </svg>
      <div className={styles.lineChartLabels}>
        {data.map((d) => (
          <span key={d.key} className={styles.lineChartLabel}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.chartStatBox}>
      <span className={styles.chartStatLabel}>{label}</span>
      <span className={styles.chartStatValue}>{value}</span>
    </div>
  );
}

export default function DashboardCharts({ enabled }: { enabled: boolean }) {
  const [rangeDays, setRangeDays] = useState(7);
  const [revenueData, setRevenueData] = useState<DayPoint[]>([]);
  const [inquiryData, setInquiryData] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, rangeDays - 1);
    return { from: start, to: end };
  }, [rangeDays]);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    const fromStr = format(from, 'yyyy-MM-dd');
    const toStr = format(to, 'yyyy-MM-dd');

    Promise.all([
      api.get<TransactionsReport>(`/reports/transactions?from=${fromStr}&to=${toStr}`),
      api.get<InquiryRow[]>('/inquiries'),
    ]).then(([txRes, inqRes]) => {
      const incomeEntries =
        txRes.success && txRes.data
          ? txRes.data.entries.filter((e) => e.kind === 'income')
          : [];
      setRevenueData(aggregateByDay(incomeEntries, from, to, true));

      const inquiries = inqRes.success && inqRes.data ? inqRes.data : [];
      const inRange = inquiries.filter((i) => {
        const d = new Date(i.createdAt);
        return d >= from && d <= new Date(to.getTime() + 86400000);
      });
      setInquiryData(aggregateByDay(inRange.map((i) => ({ date: i.createdAt })), from, to));
      setLoading(false);
    });
  }, [enabled, from, to]);

  const revenueStats = useMemo(() => {
    const values = revenueData.map((d) => d.value);
    const daysWithData = values.filter((v) => v > 0).length;
    const total = values.reduce((a, b) => a + b, 0);
    const avg = daysWithData ? total / daysWithData : 0;
    const peak = Math.max(...values, 0);
    return { avg, peak, daysWithData, totalDays: revenueData.length };
  }, [revenueData]);

  const inquiryStats = useMemo(() => {
    const values = inquiryData.map((d) => d.value);
    const daysWithData = values.filter((v) => v > 0).length;
    const total = values.reduce((a, b) => a + b, 0);
    const avg = daysWithData ? total / daysWithData : 0;
    const peak = Math.max(...values, 0);
    const peakDay = inquiryData.find((d) => d.value === peak)?.label ?? '—';
    return { avg, peak, peakDay, daysWithData, totalDays: inquiryData.length };
  }, [inquiryData]);

  if (!enabled) return null;

  const formatRs = (n: number) =>
    n >= 1000 ? `Rs. ${(n / 1000).toFixed(1)}k` : `Rs. ${n.toLocaleString()}`;

  return (
    <section className={styles.chartsSection}>
      <div className={styles.chartsToolbar}>
        <span className={styles.chartsDateRange}>
          {format(from, 'MMM dd, yyyy').toUpperCase()} — {format(to, 'MMM dd, yyyy').toUpperCase()}
        </span>
        <div className={styles.chartsRangeBtns}>
          <button
            type="button"
            className={rangeDays === 7 ? styles.rangeBtnActive : styles.rangeBtn}
            onClick={() => setRangeDays(7)}
          >
            7d
          </button>
          <button
            type="button"
            className={rangeDays === 30 ? styles.rangeBtnActive : styles.rangeBtn}
            onClick={() => setRangeDays(30)}
          >
            30d
          </button>
          <button type="button" className={styles.rangeBtn} onClick={() => setRangeDays(7)}>
            RESET
          </button>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartCardTitle}>Revenue / Collections</h3>
          {loading ? (
            <p className={styles.chartEmpty}>Loading…</p>
          ) : (
            <BarChart data={revenueData} formatValue={formatRs} />
          )}
          <div className={styles.chartStatsRow}>
            <StatBox label="Average Daily Collection" value={formatRs(revenueStats.avg)} />
            <StatBox label="Highest Daily Collection" value={formatRs(revenueStats.peak)} />
            <StatBox
              label="Days with Data"
              value={`${revenueStats.daysWithData}/${revenueStats.totalDays}`}
            />
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartCardTitle}>Sales / Inquiries Trend</h3>
          {loading ? (
            <p className={styles.chartEmpty}>Loading…</p>
          ) : (
            <LineChart data={inquiryData} />
          )}
          <div className={styles.chartStatsRow}>
            <StatBox label="Average per Day" value={inquiryStats.avg.toFixed(1)} />
            <StatBox label="Peak Day" value={inquiryStats.peakDay} />
            <StatBox
              label="Active Days"
              value={`${inquiryStats.daysWithData}/${inquiryStats.totalDays}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
