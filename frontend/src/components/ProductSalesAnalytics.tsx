import { useEffect, useState } from 'react';
import { Award, BarChart3, TrendingUp } from 'lucide-react';
import { api } from '../api/client';

interface ProductSalesRow {
  productId: string;
  productCode: string;
  productName: string;
  salesVolume: number;
  contractValue: number;
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
  totals: {
    salesVolume: number;
    revenueCollected: number;
    contractValue: number;
  };
}

const CHART_COLORS = ['#ea580c', '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ca8a04'];

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function BarChart({
  data,
  maxHeight = 140,
}: {
  data: { label: string; value: number; color?: string }[];
  maxHeight?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (data.every((d) => d.value <= 0)) {
    return <p className="text-sm text-gray-500 py-6 text-center">No sales data yet</p>;
  }
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5 pt-2" style={{ minHeight: maxHeight + 40 }}>
      {data.map((d, i) => {
        const h = Math.max(6, (d.value / max) * maxHeight);
        const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
        return (
          <div key={d.label} className="flex flex-col items-center gap-1.5 w-14 sm:w-16">
            <span className="text-[11px] font-semibold text-gray-800">{d.value}</span>
            <div
              className="w-full rounded-t-md"
              style={{ height: h, background: color }}
              title={`${d.label}: ${d.value}`}
            />
            <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RevenueBarChart({
  data,
  maxHeight = 140,
}: {
  data: { label: string; value: number; color?: string }[];
  maxHeight?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (data.every((d) => d.value <= 0)) {
    return <p className="text-sm text-gray-500 py-6 text-center">No revenue data yet</p>;
  }
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5 pt-2" style={{ minHeight: maxHeight + 52 }}>
      {data.map((d, i) => {
        const h = Math.max(6, (d.value / max) * maxHeight);
        const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
        return (
          <div key={d.label} className="flex flex-col items-center gap-1.5 w-16 sm:w-20">
            <span className="text-[10px] font-semibold text-gray-800 text-center leading-tight">
              {d.value > 0 ? formatPrice(d.value).replace('LKR', 'Rs') : '0'}
            </span>
            <div
              className="w-full rounded-t-md"
              style={{ height: h, background: color }}
              title={`${d.label}: ${formatPrice(d.value)}`}
            />
            <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ProductSalesAnalytics() {
  const [analytics, setAnalytics] = useState<ProductSalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ProductSalesAnalytics>('/products/sales/analytics');
        if (!cancelled && res.success && res.data) setAnalytics(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-orange-100 rounded-xl p-6 mb-8 shadow-sm">
        <p className="text-sm text-gray-500 text-center">Loading sales analytics…</p>
      </div>
    );
  }

  if (!analytics) return null;

  const volumeChart = analytics.products
    .filter((p) => p.salesVolume > 0)
    .map((p, i) => ({
      label: p.productCode,
      value: p.salesVolume,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  const revenueChart = analytics.products
    .filter((p) => p.revenueCollected > 0)
    .map((p, i) => ({
      label: p.productCode,
      value: p.revenueCollected,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  return (
    <section className="mb-8 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-primary" size={22} />
        <h2 className="text-lg font-bold text-gray-900">Product-wise sales tracking</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-orange-100 text-orange-700">
              <Award size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Top selling (quantity)</p>
              {analytics.topByQuantity ? (
                <>
                  <p className="text-xl font-bold text-gray-900 mt-1">{analytics.topByQuantity.productName}</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {analytics.topByQuantity.salesVolume} license
                    {analytics.topByQuantity.salesVolume === 1 ? '' : 's'} / setup
                    {analytics.topByQuantity.salesVolume === 1 ? '' : 's'} sold
                    <span className="text-orange-600 font-medium ml-1">({analytics.topByQuantity.productCode})</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-2">No product sales recorded yet. Link customers to products.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-teal-100 text-teal-700">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Top selling (revenue)</p>
              {analytics.topByRevenue ? (
                <>
                  <p className="text-xl font-bold text-gray-900 mt-1">{analytics.topByRevenue.productName}</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {formatPrice(analytics.topByRevenue.revenueCollected)} collected
                    <span className="text-teal-700 font-medium ml-1">({analytics.topByRevenue.productCode})</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-2">No collected payments linked to products yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total setups sold</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.totals.salesVolume}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold">Contract value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(analytics.totals.contractValue)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold">Revenue collected</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatPrice(analytics.totals.revenueCollected)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Sales volume by product</h3>
          <p className="text-xs text-gray-500 mb-3">Licenses / setups (linked customers)</p>
          <BarChart data={volumeChart} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Revenue by product</h3>
          <p className="text-xs text-gray-500 mb-3">Payments collected from product customers</p>
          <RevenueBarChart data={revenueChart} />
        </div>
      </div>

      {analytics.products.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold text-right">Volume</th>
                <th className="px-4 py-3 font-semibold text-right">Contract value</th>
                <th className="px-4 py-3 font-semibold text-right">Revenue collected</th>
              </tr>
            </thead>
            <tbody>
              {[...analytics.products]
                .sort((a, b) => b.salesVolume - a.salesVolume || b.revenueCollected - a.revenueCollected)
                .map((row) => (
                  <tr key={row.productId} className="border-t border-gray-100 hover:bg-orange-50/30">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{row.productName}</span>
                      <span className="ml-2 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{row.productCode}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{row.salesVolume}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatPrice(row.contractValue)}</td>
                    <td className="px-4 py-3 text-right font-medium text-primary">{formatPrice(row.revenueCollected)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
