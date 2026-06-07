import { useEffect, useState } from 'react';
import { BarChart3, Download, Loader2, ShoppingBag, TrendingDown, TrendingUp, Users, X } from 'lucide-react';
import { api } from '../api/client';
import { downloadReportXlsx } from '../lib/reportExport';
import styles from './NewInquiryModal.module.css';

export interface CampaignRoiSummary {
  campaignSales: {
    invoiceCount: number;
    productsSoldCount: number;
    description: string;
  };
  discountImpact: {
    revenueEarned: number;
    discountGiven: number;
    grossBeforeDiscount: number;
    description: string;
  };
  customerGrowth: {
    newProspects: number;
    baselineNewProspects: number;
    changePercent: number | null;
    description: string;
  };
}

export interface CampaignPerformanceReport {
  generatedAt: string;
  roi: CampaignRoiSummary;
  campaign: {
    _id: string;
    campaignId: string;
    name: string;
    startDate: string;
    endDate: string;
    discountLabel: string;
    productScope: 'all' | 'specific';
    products: { _id: string; name: string; code: string }[];
    phase: 'scheduled' | 'running' | 'ended';
    promotionalBlastStats?: { sent: number; manual: number; failed: number; skipped: number };
  };
  campaignPeriod: { from: string; to: string; label: string };
  baselineMonth: { from: string; to: string; label: string; description?: string };
  revenue: {
    paidInvoiceCount: number;
    grossAmount: number;
    discountGiven: number;
    netCollected: number;
    proposalCount: number;
    proposalPipelineValue: number;
    confirmedProposalCount: number;
  };
  productComparison: {
    productId: string;
    productCode: string;
    productName: string;
    campaignPeriodRevenue: number;
    campaignPeriodInvoiceCount: number;
    campaignAttributedRevenue: number;
    campaignAttributedInvoiceCount: number;
    baselineMonthLabel: string;
    baselineMonthRevenue: number;
    baselineMonthInvoiceCount: number;
    revenueChangePercent: number | null;
    attributedSharePercent: number | null;
  }[];
  insights: string[];
}

function lkr(n: number): string {
  return `LKR ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

interface CampaignReportModalProps {
  campaignId: string | null;
  campaignName?: string;
  onClose: () => void;
}

export default function CampaignReportModal({ campaignId, campaignName, onClose }: CampaignReportModalProps) {
  const [report, setReport] = useState<CampaignPerformanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!campaignId) {
      setReport(null);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void api.get<CampaignPerformanceReport>(`/campaigns/${campaignId}/report`).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success && res.data) setReport(res.data);
      else setError(res.error?.message || 'Could not load campaign report');
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const exportXlsx = () => {
    if (!report) return;
    const rows: (string | number)[][] = [
      ['Campaign performance report'],
      ['Campaign', report.campaign.name],
      ['ID', report.campaign.campaignId],
      ['Period', report.campaignPeriod.label],
      ['Baseline month', report.baselineMonth.label],
      ['Discount', report.campaign.discountLabel],
      [],
      ['Reporting & ROI'],
      ['Campaign sales (invoices)', report.roi.campaignSales.invoiceCount],
      ['Products sold under discount', report.roi.campaignSales.productsSoldCount],
      ['Discount impact — revenue earned', report.roi.discountImpact.revenueEarned],
      ['Discount impact — discount given', report.roi.discountImpact.discountGiven],
      ['Discount impact — gross before discount', report.roi.discountImpact.grossBeforeDiscount],
      ['Customer growth — new prospects', report.roi.customerGrowth.newProspects],
      ['Customer growth — baseline month', report.roi.customerGrowth.baselineNewProspects],
      [],
      ['Campaign-attributed revenue'],
      ['Paid invoices', report.revenue.paidInvoiceCount],
      ['Gross', report.revenue.grossAmount],
      ['Discount given', report.revenue.discountGiven],
      ['Net collected', report.revenue.netCollected],
      ['Proposals with campaign', report.revenue.proposalCount],
      ['Proposal pipeline value', report.revenue.proposalPipelineValue],
      [],
      ['Product comparison'],
      [
        'Product',
        'Code',
        `Campaign period (${report.campaignPeriod.label})`,
        'Invoices',
        'Campaign-tagged revenue',
        `Baseline (${report.baselineMonth.label})`,
        'Change %',
      ],
      ...report.productComparison.map((r) => [
        r.productName,
        r.productCode,
        r.campaignPeriodRevenue,
        r.campaignPeriodInvoiceCount,
        r.campaignAttributedRevenue,
        r.baselineMonthRevenue,
        r.revenueChangePercent ?? '—',
      ]),
      [],
      ['Insights'],
      ...report.insights.map((i) => [i]),
    ];
    downloadReportXlsx(`${report.campaign.campaignId}-report`, rows, 'Campaign');
  };

  if (!campaignId) return null;

  const title = report?.campaign.name ?? campaignName ?? 'Campaign report';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '44rem', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className={styles.header}>
          <h2 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={22} className="text-orange-500" />
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {report ? (
              <button
                type="button"
                onClick={exportXlsx}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline px-2 py-1"
              >
                <Download size={16} />
                Export
              </button>
            ) : null}
            <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-gray-500 py-10 justify-center">
            <Loader2 size={20} className="animate-spin" />
            Building report…
          </p>
        ) : error ? (
          <p className="text-red-600 text-sm py-6 px-4">{error}</p>
        ) : report ? (
          <div className="px-1 pb-4 space-y-6 text-sm">
            <div className="rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2.5 text-gray-700 space-y-1">
              <p>
                <span className="font-semibold text-orange-900">Campaign period</span> — dates you set on the
                festival campaign. All paid invoice totals in the table below use invoices dated{' '}
                <strong>inside this window only</strong> (inclusive start and end).
              </p>
              <p className="text-base font-semibold text-gray-900">{report.campaignPeriod.label}</p>
              <p className="text-xs text-gray-600">
                Baseline for “vs last month”: <strong>{report.baselineMonth.description ?? report.baselineMonth.label}</strong>
                — not part of the campaign; used only for the % change column.
              </p>
            </div>

            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Reporting &amp; ROI</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-orange-200 bg-orange-50/90 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-orange-900 uppercase font-semibold mb-1">
                    <ShoppingBag size={14} />
                    Campaign sales
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{report.roi.campaignSales.invoiceCount}</div>
                  <div className="text-xs text-gray-700 mt-1">
                    paid sale{report.roi.campaignSales.invoiceCount === 1 ? '' : 's'} under this discount
                    {report.roi.campaignSales.productsSoldCount > 0 ? (
                      <>
                        {' '}
                        · {report.roi.campaignSales.productsSoldCount} product
                        {report.roi.campaignSales.productsSoldCount === 1 ? '' : 's'}
                      </>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 leading-snug">{report.roi.campaignSales.description}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-900 uppercase font-semibold mb-1">
                    <BarChart3 size={14} />
                    Discount impact
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    Revenue: {lkr(report.roi.discountImpact.revenueEarned)}
                  </div>
                  <div className="text-sm text-red-700 font-medium">
                    Discount given: {lkr(report.roi.discountImpact.discountGiven)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Gross before discount: {lkr(report.roi.discountImpact.grossBeforeDiscount)}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 leading-snug">{report.roi.discountImpact.description}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-blue-900 uppercase font-semibold mb-1">
                    <Users size={14} />
                    Customer growth
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{report.roi.customerGrowth.newProspects}</div>
                  <div className="text-xs text-gray-700">
                    new prospect{report.roi.customerGrowth.newProspects === 1 ? '' : 's'} in festival period
                    {report.roi.customerGrowth.changePercent != null ? (
                      <span
                        className={`ml-1 font-semibold ${
                          report.roi.customerGrowth.changePercent >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        ({report.roi.customerGrowth.changePercent >= 0 ? '+' : ''}
                        {report.roi.customerGrowth.changePercent}% vs {report.baselineMonth.label})
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 leading-snug">{report.roi.customerGrowth.description}</p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-600 uppercase font-semibold">Proposals</div>
                <div className="text-lg font-bold text-gray-900">{report.revenue.proposalCount}</div>
                <div className="text-xs text-gray-600">{lkr(report.revenue.proposalPipelineValue)} pipeline</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-600 uppercase font-semibold">Confirmed proposals</div>
                <div className="text-lg font-bold text-gray-900">{report.revenue.confirmedProposalCount}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs text-gray-600 uppercase font-semibold">Offer</div>
                <div className="text-lg font-bold text-orange-700">{report.campaign.discountLabel}</div>
              </div>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Product sales vs last month</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Campaign period</th>
                      <th className="px-3 py-2 text-right">{report.baselineMonth.label}</th>
                      <th className="px-3 py-2 text-right">Change</th>
                      <th className="px-3 py-2 text-right">Via campaign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.productComparison.map((row) => (
                      <tr key={row.productId} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium">
                          {row.productName}{' '}
                          <span className="text-gray-500">({row.productCode})</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {lkr(row.campaignPeriodRevenue)}
                          <div className="text-gray-500">{row.campaignPeriodInvoiceCount} inv.</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {lkr(row.baselineMonthRevenue)}
                          <div className="text-gray-500">{row.baselineMonthInvoiceCount} inv.</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.revenueChangePercent == null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-0.5 font-semibold ${
                                row.revenueChangePercent >= 0 ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {row.revenueChangePercent >= 0 ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              {row.revenueChangePercent > 0 ? '+' : ''}
                              {row.revenueChangePercent}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-orange-700">
                          {lkr(row.campaignAttributedRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                “Campaign period” is all paid invoices for each product during the festival dates. “Via campaign” is
                only invoices tagged with this campaign discount.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900 mb-2">Insights</h3>
              <ul className="space-y-2 list-disc pl-5 text-gray-700">
                {report.insights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            {report.campaign.promotionalBlastStats ? (
              <p className="text-xs text-gray-500">
                Promotional blast: {report.campaign.promotionalBlastStats.sent} auto-sent,{' '}
                {report.campaign.promotionalBlastStats.manual} manual,{' '}
                {report.campaign.promotionalBlastStats.skipped} skipped.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
