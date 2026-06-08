import mongoose from 'mongoose';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { ProductModel } from '../../infrastructure/database/models/ProductModel';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';
import {
  campaignPeriodLabel,
  endOfCalendarDay,
  formatCalendarDateEnGb,
  startOfCalendarDay,
} from '../../domain/campaignDates';
import { CampaignService } from './CampaignService';
import { ProductReportService } from './ProductReportService';

export interface CampaignProductComparisonRow {
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
}

/** End-of-campaign ROI summary (Reporting & ROI spec). */
export interface CampaignRoiSummary {
  campaignSales: {
    /** Paid invoices tagged with this campaign discount during the festival period. */
    invoiceCount: number;
    /** Distinct catalog products on those invoices. */
    productsSoldCount: number;
    description: string;
  };
  discountImpact: {
    /** Net revenue collected on campaign-tagged paid invoices. */
    revenueEarned: number;
    /** Total promotional discount given (accounting line-item total). */
    discountGiven: number;
    /** Pre-discount gross on those invoices. */
    grossBeforeDiscount: number;
    description: string;
  };
  customerGrowth: {
    /** New inquiries (prospects) created during the campaign period. */
    newProspects: number;
    /** Inquiries created in the calendar month before the campaign. */
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
  baselineMonth: { from: string; to: string; label: string; description: string };
  revenue: {
    paidInvoiceCount: number;
    grossAmount: number;
    discountGiven: number;
    netCollected: number;
    proposalCount: number;
    proposalPipelineValue: number;
    confirmedProposalCount: number;
  };
  productComparison: CampaignProductComparisonRow[];
  insights: string[];
}

function monthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function previousCalendarMonth(ref: Date): { from: Date; to: Date; label: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0, 23, 59, 59, 999);
  return {
    from,
    to,
    label: monthLabel(from.getFullYear(), from.getMonth() + 1),
  };
}

function formatDiscountLabel(type: 'percent' | 'flat', value: number): string {
  return type === 'flat' ? `LKR ${value.toLocaleString('en-LK')} off` : `${value}% off`;
}

function pctChange(current: number, baseline: number): number | null {
  if (baseline <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - baseline) / baseline) * 1000) / 10;
}

export class CampaignReportService {
  private campaignService = new CampaignService();
  private productReportService = new ProductReportService();

  async getPerformanceReport(campaignMongoId: string): Promise<CampaignPerformanceReport | null> {
    if (!mongoose.Types.ObjectId.isValid(campaignMongoId)) return null;

    const campaign = await this.campaignService.findById(campaignMongoId);
    if (!campaign) return null;

    await this.productReportService.syncProductLinks();

    const campaignOid = new mongoose.Types.ObjectId(campaignMongoId);
    const periodFrom = startOfCalendarDay(campaign.startDate);
    const periodTo = endOfCalendarDay(campaign.endDate);
    const baseline = previousCalendarMonth(periodFrom);

    let scopedProducts: { _id: string; name: string; code: string }[];
    if (campaign.productScope === 'all') {
      const all = await ProductModel.find().sort({ name: 1 }).select('name code').lean();
      scopedProducts = all.map((p) => ({
        _id: String(p._id),
        name: p.name,
        code: p.code,
      }));
    } else {
      scopedProducts =
        campaign.products?.map((p) => ({ _id: p._id, name: p.name, code: p.code })) ?? [];
      if (scopedProducts.length === 0 && campaign.productIds?.length) {
        const docs = await ProductModel.find({ _id: { $in: campaign.productIds } })
          .select('name code')
          .lean();
        scopedProducts = docs.map((p) => ({
          _id: String(p._id),
          name: p.name,
          code: p.code,
        }));
      }
    }

    const scopedOids = scopedProducts.map((p) => new mongoose.Types.ObjectId(p._id));

    const invoiceMatch = {
      status: 'paid' as const,
      campaignId: campaignOid,
      invoiceDate: { $gte: periodFrom, $lte: periodTo },
    };

    const [invoiceTotals] = await InvoiceModel.aggregate<{
      count: number;
      gross: number;
      discount: number;
      net: number;
    }>([
      { $match: invoiceMatch },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          gross: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$originalAmount', 0] }, 0] },
                '$originalAmount',
                { $add: ['$totalAmount', { $ifNull: ['$discountAmt', 0] }] },
              ],
            },
          },
          discount: { $sum: { $ifNull: ['$discountAmt', 0] } },
          net: { $sum: '$totalAmount' },
        },
      },
    ]);

    const proposals = await ProposalModel.find({
      campaignId: campaignOid,
      createdAt: { $gte: periodFrom, $lte: periodTo },
    })
      .select('totalAmount status')
      .lean();

    const proposalPipelineValue = proposals.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
    const confirmedProposalCount = proposals.filter((p) => p.status === 'CONFIRMED').length;

    const periodProductAgg = await InvoiceModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      total: number;
      count: number;
      attributed: number;
      attributedCount: number;
    }>([
      {
        $match: {
          status: 'paid',
          productId: { $in: scopedOids },
          invoiceDate: { $gte: periodFrom, $lte: periodTo },
        },
      },
      {
        $group: {
          _id: '$productId',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
          attributed: {
            $sum: {
              $cond: [{ $eq: ['$campaignId', campaignOid] }, '$totalAmount', 0],
            },
          },
          attributedCount: {
            $sum: { $cond: [{ $eq: ['$campaignId', campaignOid] }, 1, 0] },
          },
        },
      },
    ]);

    const baselineProductAgg = await InvoiceModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      total: number;
      count: number;
    }>([
      {
        $match: {
          status: 'paid',
          productId: { $in: scopedOids },
          invoiceDate: { $gte: baseline.from, $lte: baseline.to },
        },
      },
      {
        $group: {
          _id: '$productId',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const periodMap = new Map(periodProductAgg.map((r) => [String(r._id), r]));
    const baselineMap = new Map(baselineProductAgg.map((r) => [String(r._id), r]));

    const productComparison: CampaignProductComparisonRow[] = scopedProducts.map((p) => {
      const during = periodMap.get(p._id);
      const base = baselineMap.get(p._id);
      const campaignPeriodRevenue = during?.total ?? 0;
      const baselineMonthRevenue = base?.total ?? 0;
      const campaignAttributedRevenue = during?.attributed ?? 0;
      return {
        productId: p._id,
        productCode: p.code,
        productName: p.name,
        campaignPeriodRevenue,
        campaignPeriodInvoiceCount: during?.count ?? 0,
        campaignAttributedRevenue,
        campaignAttributedInvoiceCount: during?.attributedCount ?? 0,
        baselineMonthLabel: baseline.label,
        baselineMonthRevenue,
        baselineMonthInvoiceCount: base?.count ?? 0,
        revenueChangePercent: pctChange(campaignPeriodRevenue, baselineMonthRevenue),
        attributedSharePercent:
          campaignPeriodRevenue > 0
            ? Math.round((campaignAttributedRevenue / campaignPeriodRevenue) * 1000) / 10
            : null,
      };
    });

    productComparison.sort((a, b) => b.campaignPeriodRevenue - a.campaignPeriodRevenue);

    const paidInvoiceCount = invoiceTotals?.count ?? 0;
    const grossAmount = Math.round((invoiceTotals?.gross ?? 0) * 100) / 100;
    const discountGiven = Math.round((invoiceTotals?.discount ?? 0) * 100) / 100;
    const netCollected = Math.round((invoiceTotals?.net ?? 0) * 100) / 100;

    const [productsSoldAgg] = await InvoiceModel.aggregate<{ count: number }>([
      { $match: invoiceMatch },
      { $group: { _id: '$productId' } },
      { $count: 'count' },
    ]);
    const productsSoldCount = productsSoldAgg?.count ?? 0;

    const newProspectsInPeriod = await InquiryModel.countDocuments({
      createdAt: { $gte: periodFrom, $lte: periodTo },
    });
    const baselineNewProspects = await InquiryModel.countDocuments({
      createdAt: { $gte: baseline.from, $lte: baseline.to },
    });

    const roi: CampaignRoiSummary = {
      campaignSales: {
        invoiceCount: paidInvoiceCount,
        productsSoldCount,
        description:
          'Total paid sales recorded with this campaign discount during the festival dates (one invoice = one sale event).',
      },
      discountImpact: {
        revenueEarned: netCollected,
        discountGiven,
        grossBeforeDiscount: grossAmount,
        description:
          'Revenue earned is net collected on campaign-tagged invoices; discount given is the separate promotional line total for accounting.',
      },
      customerGrowth: {
        newProspects: newProspectsInPeriod,
        baselineNewProspects,
        changePercent: pctChange(newProspectsInPeriod, baselineNewProspects),
        description:
          'New prospects are inquiries created during the campaign period (inclusive start and end dates).',
      },
    };

    const insights = this.buildInsights(
      campaign.name,
      formatDiscountLabel(campaign.discountType, campaign.discountValue),
      baseline.label,
      netCollected,
      discountGiven,
      newProspectsInPeriod,
      baselineNewProspects,
      productComparison
    );

    return {
      generatedAt: new Date().toISOString(),
      roi,
      campaign: {
        _id: campaign._id!,
        campaignId: campaign.campaignId,
        name: campaign.name,
        startDate: new Date(campaign.startDate).toISOString(),
        endDate: new Date(campaign.endDate).toISOString(),
        discountLabel: formatDiscountLabel(campaign.discountType, campaign.discountValue),
        productScope: campaign.productScope,
        products: scopedProducts,
        phase: campaign.phase,
        promotionalBlastStats: campaign.promotionalBlastStats,
      },
      campaignPeriod: {
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
        label: campaignPeriodLabel(periodFrom, periodTo),
      },
      baselineMonth: {
        from: baseline.from.toISOString(),
        to: baseline.to.toISOString(),
        label: baseline.label,
        description: `Full calendar month before campaign start (${formatCalendarDateEnGb(baseline.from)} – ${formatCalendarDateEnGb(baseline.to)})`,
      },
      revenue: {
        paidInvoiceCount,
        grossAmount,
        discountGiven,
        netCollected,
        proposalCount: proposals.length,
        proposalPipelineValue: Math.round(proposalPipelineValue * 100) / 100,
        confirmedProposalCount,
      },
      productComparison,
      insights,
    };
  }

  private buildInsights(
    campaignName: string,
    discountLabel: string,
    baselineLabel: string,
    netCollected: number,
    discountGiven: number,
    newProspects: number,
    baselineProspects: number,
    rows: CampaignProductComparisonRow[]
  ): string[] {
    const insights: string[] = [];

    const prospectChange = pctChange(newProspects, baselineProspects);
    if (newProspects > 0) {
      insights.push(
        `Customer growth: ${newProspects} new prospect${newProspects === 1 ? '' : 's'} during the festival` +
          (prospectChange != null
            ? ` (${prospectChange >= 0 ? '+' : ''}${prospectChange}% vs ${baselineLabel}, ${baselineProspects} prior).`
            : '.')
      );
    } else {
      insights.push(
        `No new inquiries were created during "${campaignName}" — customer growth will appear when prospects are added in the campaign window.`
      );
    }

    if (netCollected > 0) {
      insights.push(
        `"${campaignName}" (${discountLabel}) generated LKR ${netCollected.toLocaleString('en-LK')} in paid invoice revenue during the campaign period.`
      );
    } else {
      insights.push(
        `No paid invoices are tagged to "${campaignName}" yet — revenue appears when proposals use this discount and invoices are marked paid.`
      );
    }

    if (discountGiven > 0) {
      insights.push(`Total discount given on campaign-tagged invoices: LKR ${discountGiven.toLocaleString('en-LK')}.`);
    }

    for (const row of rows) {
      if (row.campaignPeriodRevenue === 0 && row.baselineMonthRevenue === 0) continue;
      const change = row.revenueChangePercent;
      if (change == null) {
        if (row.campaignPeriodRevenue > 0) {
          insights.push(
            `${row.productName} (${row.productCode}) had LKR ${row.campaignPeriodRevenue.toLocaleString('en-LK')} in sales during the campaign; no paid sales in ${baselineLabel} to compare.`
          );
        }
        continue;
      }
      const dir = change >= 0 ? 'up' : 'down';
      const abs = Math.abs(change);
      insights.push(
        `${row.productName} (${row.productCode}) paid revenue was ${dir} ${abs}% during the campaign period vs calendar month ${baselineLabel} (LKR ${row.campaignPeriodRevenue.toLocaleString('en-LK')} vs LKR ${row.baselineMonthRevenue.toLocaleString('en-LK')}).`
      );
      if (row.campaignAttributedRevenue > 0 && row.attributedSharePercent != null) {
        insights.push(
          `Of ${row.productCode} sales in the campaign window, ${row.attributedSharePercent}% (LKR ${row.campaignAttributedRevenue.toLocaleString('en-LK')}) came from invoices explicitly using this campaign discount.`
        );
      }
    }

    const pos = rows.find((r) => r.productCode.toUpperCase() === 'POS');
    if (pos && pos.revenueChangePercent != null) {
      const q = pos.revenueChangePercent >= 0 ? 'increased' : 'decreased';
      insights.unshift(
        `Analytics: Did the ${discountLabel} boost POS? Paid POS revenue ${q} ${Math.abs(pos.revenueChangePercent)}% vs ${baselineLabel} (${pos.campaignPeriodRevenue.toLocaleString('en-LK')} vs ${pos.baselineMonthRevenue.toLocaleString('en-LK')}).`
      );
    }

    return insights.slice(0, 12);
  }
}
