import { useEffect, useMemo, useState } from 'react';
import { Package, TrendingUp, Users } from 'lucide-react';
import { api } from '../api/client';
import styles from '../pages/Inquiries.module.css';

interface ProfitabilityRow {
  productId: string;
  productCode: string;
  productName: string;
  revenue: number;
  projectCosts: number;
  netProfit: number;
  marginPercent: number | null;
}

interface ProfitabilityReport {
  period: string;
  rows: ProfitabilityRow[];
  totals: { revenue: number; projectCosts: number; netProfit: number };
}

interface DensityRow {
  productId: string;
  productCode: string;
  productName: string;
  activeCustomers: number;
  totalCustomers: number;
  sharePercent: number;
}

interface DensityReport {
  rows: DensityRow[];
  topProduct: DensityRow | null;
}

interface SalesTrendsReport {
  months: number;
  byProduct: Record<
    string,
    {
      productCode: string;
      productName: string;
      points: { label: string; revenue: number; growthPercent: number | null }[];
    }
  >;
}

interface ProductWiseReportsProps {
  periodQuery: string;
  selectedProductId: string;
}

const formatRs = (n: number) => `Rs. ${Number(n).toLocaleString()}`;

export default function ProductWiseReports({ periodQuery, selectedProductId }: ProductWiseReportsProps) {
  const [profitability, setProfitability] = useState<ProfitabilityReport | null>(null);
  const [density, setDensity] = useState<DensityReport | null>(null);
  const [trends, setTrends] = useState<SalesTrendsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const reportQuery = useMemo(() => {
    const parts = [periodQuery, selectedProductId ? `productId=${selectedProductId}` : ''].filter(Boolean);
    return parts.length ? `?${parts.join('&')}` : '';
  }, [periodQuery, selectedProductId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get<ProfitabilityReport>(`/reports/products/profitability${reportQuery}`),
      api.get<DensityReport>(
        `/reports/products/customer-density${selectedProductId ? `?productId=${selectedProductId}` : ''}`
      ),
      api.get<SalesTrendsReport>('/reports/products/sales-trends?months=12'),
    ])
      .then(([pRes, dRes, tRes]) => {
        if (cancelled) return;
        if (pRes.success && pRes.data) setProfitability(pRes.data);
        if (dRes.success && dRes.data) setDensity(dRes.data);
        if (tRes.success && tRes.data) setTrends(tRes.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportQuery, selectedProductId]);

  const posErpTrends = useMemo(() => {
    if (!trends?.byProduct) return [];
    return ['POS', 'ERP']
      .filter((code) => trends.byProduct[code])
      .map((code) => ({ code, ...trends.byProduct[code] }));
  }, [trends]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading product reports…</p>;
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-gray-600 max-w-3xl">
        Product-wise reporting: profitability per catalog item, active customer density, and monthly sales
        growth for POS vs ERP.
        {selectedProductId ? (
          <>
            {' '}
            Filtered to one product — clear the product filter to compare all lines.
          </>
        ) : null}
      </p>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-primary" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Product profitability</h3>
        </div>
        {profitability && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 max-w-4xl">
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <span className="text-xs text-gray-500 uppercase">Revenue</span>
                <p className="text-xl font-bold text-emerald-700 mt-1">{formatRs(profitability.totals.revenue)}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <span className="text-xs text-gray-500 uppercase">Project costs</span>
                <p className="text-xl font-bold text-red-700 mt-1">{formatRs(profitability.totals.projectCosts)}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
                <span className="text-xs text-gray-600 uppercase">Net profit</span>
                <p className="text-xl font-bold text-emerald-800 mt-1">{formatRs(profitability.totals.netProfit)}</p>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className="px-6 py-4 text-orange-500 font-bold text-sm">Product</th>
                    <th className="px-6 py-4 text-orange-500 font-bold text-sm">Revenue</th>
                    <th className="px-6 py-4 text-orange-500 font-bold text-sm">Costs</th>
                    <th className="px-6 py-4 text-orange-500 font-bold text-sm">Net profit</th>
                    <th className="px-6 py-4 text-orange-500 font-bold text-sm">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {profitability.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No paid invoices linked to products in this period.
                      </td>
                    </tr>
                  ) : (
                    profitability.rows.map((row) => (
                      <tr key={row.productId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {row.productName}
                          <span className="ml-2 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                            {row.productCode}
                          </span>
                        </td>
                        <td className="px-6 py-4">{formatRs(row.revenue)}</td>
                        <td className="px-6 py-4 text-red-700">{formatRs(row.projectCosts)}</td>
                        <td
                          className={`px-6 py-4 font-semibold ${row.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                        >
                          {formatRs(row.netProfit)}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {row.marginPercent != null ? `${row.marginPercent.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-primary" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Customer density</h3>
        </div>
        {density?.topProduct && (
          <p className="text-sm text-gray-600 mb-4">
            Highest active users:{' '}
            <strong className="text-gray-900">
              {density.topProduct.productName} ({density.topProduct.activeCustomers} active)
            </strong>
          </p>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Product</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Active customers</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Total linked</th>
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Share of active base</th>
              </tr>
            </thead>
            <tbody>
              {(density?.rows ?? []).map((row) => (
                <tr key={row.productId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {row.productName}
                    <span className="ml-2 text-xs text-gray-500">{row.productCode}</span>
                  </td>
                  <td className="px-6 py-4 font-semibold">{row.activeCustomers}</td>
                  <td className="px-6 py-4">{row.totalCustomers}</td>
                  <td className="px-6 py-4">{row.sharePercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Package className="text-primary" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Sales trends (POS vs ERP)</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">Monthly paid-invoice revenue and month-over-month growth %.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {posErpTrends.map(({ code, productName, points }) => (
            <div key={code} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">
                {productName} <span className="text-orange-600">({code})</span>
              </h4>
              {points.length === 0 ? (
                <p className="text-sm text-gray-500">No monthly revenue yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-orange-500 font-bold text-xs">Month</th>
                        <th className="px-4 py-2 text-orange-500 font-bold text-xs">Revenue</th>
                        <th className="px-4 py-2 text-orange-500 font-bold text-xs">Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((pt) => (
                        <tr key={pt.label}>
                          <td className="px-4 py-2 text-gray-700">{pt.label}</td>
                          <td className="px-4 py-2">{formatRs(pt.revenue)}</td>
                          <td className="px-4 py-2">
                            {pt.growthPercent != null ? (
                              <span
                                className={
                                  pt.growthPercent >= 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'
                                }
                              >
                                {pt.growthPercent >= 0 ? '+' : ''}
                                {pt.growthPercent.toFixed(1)}%
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
