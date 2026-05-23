interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

const CHART_COLORS = ['#ea580c', '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ca8a04'];

function formatRs(n: number): string {
  return `Rs. ${Number(n).toLocaleString()}`;
}

function PieChart({ data, size = 180 }: { data: ChartSlice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No data for chart</p>;
  }
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;
  const slices = data.filter((d) => d.value > 0).map((d, i) => {
    const slice = (d.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...d, path, color: d.color || CHART_COLORS[i % CHART_COLORS.length] };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {slices.map((s) => (
          <path key={s.label} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <ul className="space-y-2 text-sm min-w-[160px]">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-700 flex-1">{s.label}</span>
            <span className="font-semibold text-gray-900">{((s.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChart({ data, maxHeight = 160 }: { data: ChartSlice[]; maxHeight?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (data.every((d) => d.value <= 0)) {
    return <p className="text-sm text-gray-500 py-8 text-center">No data for chart</p>;
  }
  return (
    <div className="flex items-end justify-center gap-4 sm:gap-6 pt-4" style={{ minHeight: maxHeight + 48 }}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.value / max) * maxHeight);
        const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
        return (
          <div key={d.label} className="flex flex-col items-center gap-2 w-16 sm:w-20">
            <span className="text-xs font-semibold text-gray-800 text-center leading-tight">
              {d.value > 0 ? formatRs(d.value).replace('Rs. ', '') : '0'}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: h, background: color }}
              title={`${d.label}: ${formatRs(d.value)}`}
            />
            <span className="text-[11px] text-gray-600 text-center leading-tight">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface FinancialChartProps {
  incomeTotal: number;
  expenseTotal: number;
  netProfit: number;
  incomeSlices: { label: string; value: number }[];
  expenseSlices: { label: string; value: number }[];
}

export function ReportFinancialCharts({
  incomeTotal,
  expenseTotal,
  netProfit,
  incomeSlices,
  expenseSlices,
}: FinancialChartProps) {
  const overview: ChartSlice[] = [
    { label: 'Income', value: incomeTotal, color: '#059669' },
    { label: 'Expenses', value: expenseTotal, color: '#dc2626' },
    { label: 'Net profit', value: Math.max(0, netProfit), color: '#2563eb' },
  ];

  const incomeData = incomeSlices.map((s, i) => ({
    ...s,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const expenseData = expenseSlices.map((s, i) => ({
    ...s,
    color: CHART_COLORS[(i + 2) % CHART_COLORS.length],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Profit overview</h3>
        <BarChart data={overview} />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Income mix</h3>
        <PieChart data={incomeData} />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Expense mix</h3>
        <PieChart data={expenseData} />
      </div>
    </div>
  );
}
