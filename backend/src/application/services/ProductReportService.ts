import mongoose from 'mongoose';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { ProductModel } from '../../infrastructure/database/models/ProductModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { ProductService } from './ProductService';

export interface ReportPeriodParams {
  year?: number;
  month?: number;
  from?: string;
  to?: string;
  productId?: string;
}

export interface ProductProfitabilityRow {
  productId: string;
  productCode: string;
  productName: string;
  revenue: number;
  projectCosts: number;
  netProfit: number;
  marginPercent: number | null;
}

export interface ProductProfitabilityReport {
  period: string;
  productId?: string;
  rows: ProductProfitabilityRow[];
  totals: { revenue: number; projectCosts: number; netProfit: number };
}

export interface ProductCustomerDensityRow {
  productId: string;
  productCode: string;
  productName: string;
  activeCustomers: number;
  totalCustomers: number;
  sharePercent: number;
}

export interface ProductCustomerDensityReport {
  productId?: string;
  rows: ProductCustomerDensityRow[];
  topProduct: ProductCustomerDensityRow | null;
}

export interface ProductSalesTrendPoint {
  year: number;
  month: number;
  label: string;
  productCode: string;
  productName: string;
  revenue: number;
  growthPercent: number | null;
}

export interface ProductSalesTrendsReport {
  months: number;
  series: ProductSalesTrendPoint[];
  byProduct: Record<
    string,
    {
      productId: string;
      productCode: string;
      productName: string;
      points: { label: string; year: number; month: number; revenue: number; growthPercent: number | null }[];
    }
  >;
}

export interface TopProductLeaderboardRow {
  rank: number;
  productId: string;
  productCode: string;
  productName: string;
  salesVolume: number;
  revenueCollected: number;
  netProfit: number;
}

export interface TopProductsLeaderboard {
  updatedAt: string;
  rows: TopProductLeaderboardRow[];
}

function resolvePeriod(params?: ReportPeriodParams): {
  from?: Date;
  to?: Date;
  period: string;
} {
  if (params?.from && params?.to) {
    const start = new Date(params.from);
    const end = new Date(params.to);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { from: start, to: end, period: `${start.toLocaleDateString('en-GB')} – ${end.toLocaleDateString('en-GB')}` };
    }
  }
  if (params?.year && params?.month) {
    const start = new Date(params.year, params.month - 1, 1);
    const end = new Date(params.year, params.month, 0, 23, 59, 59, 999);
    return {
      from: start,
      to: end,
      period: `${params.year}-${String(params.month).padStart(2, '0')}`,
    };
  }
  return { period: 'all-time' };
}

function sumPayoutsMap(payouts: unknown): number {
  if (!payouts || typeof payouts !== 'object') return 0;
  if (payouts instanceof Map) {
    let s = 0;
    for (const v of payouts.values()) s += Number(v) || 0;
    return s;
  }
  return Object.values(payouts as Record<string, number>).reduce((a, v) => a + (Number(v) || 0), 0);
}

export class ProductReportService {
  private productService = new ProductService();

  /** Backfill productId on invoices/projects from linked customers. */
  async syncProductLinks(): Promise<void> {
    const customers = await CustomerModel.find({ productId: { $ne: null } })
      .select('_id productId')
      .lean();
    for (const c of customers) {
      if (!c.productId) continue;
      const cid = c._id;
      await Promise.all([
        InvoiceModel.updateMany(
          { clientId: cid, $or: [{ productId: null }, { productId: { $exists: false } }] },
          { $set: { productId: c.productId } }
        ),
        ProjectModel.updateMany(
          { clientId: cid, $or: [{ productId: null }, { productId: { $exists: false } }] },
          { $set: { productId: c.productId } }
        ),
      ]);
    }
  }

  private async productFilterObjectId(productId?: string): Promise<mongoose.Types.ObjectId | null> {
    if (!productId?.trim() || !mongoose.Types.ObjectId.isValid(productId)) return null;
    return new mongoose.Types.ObjectId(productId);
  }

  async getProfitability(period?: ReportPeriodParams): Promise<ProductProfitabilityReport> {
    await this.productService.ensureDefaults();
    await this.syncProductLinks();

    const periodInfo = resolvePeriod(period);
    const filterPid = await this.productFilterObjectId(period?.productId);

    const invoiceMatch: Record<string, unknown> = { status: 'paid' };
    if (periodInfo.from && periodInfo.to) {
      invoiceMatch.invoiceDate = { $gte: periodInfo.from, $lte: periodInfo.to };
    }
    if (filterPid) invoiceMatch.productId = filterPid;

    const revenueRows = await InvoiceModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
      { $match: invoiceMatch },
      { $group: { _id: '$productId', total: { $sum: '$totalAmount' } } },
    ]);

    const projectMatch: Record<string, unknown> = {};
    if (filterPid) projectMatch.productId = filterPid;

    const projectDocs = await ProjectModel.find(projectMatch)
      .select('productId expenses assignedEmployeePayouts')
      .lean();

    const costMap = new Map<string, number>();
    for (const p of projectDocs) {
      const pid = p.productId ? String(p.productId) : '';
      if (!pid) continue;
      const cost = (Number(p.expenses) || 0) + sumPayoutsMap(p.assignedEmployeePayouts);
      costMap.set(pid, (costMap.get(pid) ?? 0) + cost);
    }

    const revenueMap = new Map<string, number>();
    for (const row of revenueRows) {
      if (row._id) revenueMap.set(String(row._id), row.total);
    }

    const productDocs = filterPid
      ? await ProductModel.find({ _id: filterPid }).lean()
      : await ProductModel.find().sort({ name: 1 }).lean();

    const rows: ProductProfitabilityRow[] = productDocs.map((p) => {
      const id = String(p._id);
      const revenue = revenueMap.get(id) ?? 0;
      const projectCosts = costMap.get(id) ?? 0;
      const netProfit = revenue - projectCosts;
      return {
        productId: id,
        productCode: p.code,
        productName: p.name,
        revenue,
        projectCosts,
        netProfit,
        marginPercent: revenue > 0 ? (netProfit / revenue) * 100 : null,
      };
    });

    rows.sort((a, b) => b.netProfit - a.netProfit);

    return {
      period: periodInfo.period,
      productId: period?.productId,
      rows,
      totals: {
        revenue: rows.reduce((s, r) => s + r.revenue, 0),
        projectCosts: rows.reduce((s, r) => s + r.projectCosts, 0),
        netProfit: rows.reduce((s, r) => s + r.netProfit, 0),
      },
    };
  }

  async getCustomerDensity(productId?: string): Promise<ProductCustomerDensityReport> {
    await this.productService.ensureDefaults();
    const filterPid = await this.productFilterObjectId(productId);

    const match: Record<string, unknown> = { productId: { $ne: null } };
    if (filterPid) match.productId = filterPid;

    const densityRows = await CustomerModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      active: number;
      total: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: '$productId',
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
    ]);

    const activeTotal = densityRows.reduce((s, r) => s + r.active, 0);
    const productDocs = filterPid
      ? await ProductModel.find({ _id: filterPid }).lean()
      : await ProductModel.find().sort({ name: 1 }).lean();

    const densityMap = new Map<string, { active: number; total: number }>();
    for (const row of densityRows) {
      if (row._id) densityMap.set(String(row._id), { active: row.active, total: row.total });
    }

    const rows: ProductCustomerDensityRow[] = productDocs.map((p) => {
      const id = String(p._id);
      const d = densityMap.get(id) ?? { active: 0, total: 0 };
      return {
        productId: id,
        productCode: p.code,
        productName: p.name,
        activeCustomers: d.active,
        totalCustomers: d.total,
        sharePercent: activeTotal > 0 ? (d.active / activeTotal) * 100 : 0,
      };
    });

    rows.sort((a, b) => b.activeCustomers - a.activeCustomers);
    const topProduct = rows.find((r) => r.activeCustomers > 0) ?? null;

    return { productId, rows, topProduct };
  }

  async getSalesTrends(months = 12): Promise<ProductSalesTrendsReport> {
    await this.productService.ensureDefaults();
    await this.syncProductLinks();

    const productDocs = await ProductModel.find({ code: { $in: ['POS', 'ERP'] } }).lean();

    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);

    const agg = await InvoiceModel.aggregate<{
      _id: { year: number; month: number; productId: mongoose.Types.ObjectId };
      total: number;
    }>([
      {
        $match: {
          status: 'paid',
          productId: { $ne: null },
          invoiceDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' },
            productId: '$productId',
          },
          total: { $sum: '$totalAmount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const allProducts = await ProductModel.find().lean();
    const productMeta = new Map(allProducts.map((p) => [String(p._id), p]));

    const byProduct: ProductSalesTrendsReport['byProduct'] = {};
    for (const p of productDocs) {
      byProduct[p.code] = {
        productId: String(p._id),
        productCode: p.code,
        productName: p.name,
        points: [],
      };
    }

    const series: ProductSalesTrendPoint[] = [];
    const prevRevenue = new Map<string, number>();

    for (const row of agg) {
      const meta = productMeta.get(String(row._id.productId));
      if (!meta) continue;
      const key = `${meta.code}-${row._id.year}-${row._id.month}`;
      const prevKey = `${meta.code}-${row._id.year}-${row._id.month - 1}`;
      const prev = prevRevenue.get(prevKey) ?? prevRevenue.get(`${meta.code}-${row._id.year - 1}-12`);
      const growthPercent = prev != null && prev > 0 ? ((row.total - prev) / prev) * 100 : null;
      prevRevenue.set(key, row.total);

      const label = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
      const point = {
        year: row._id.year,
        month: row._id.month,
        label,
        productCode: meta.code,
        productName: meta.name,
        revenue: row.total,
        growthPercent,
      };
      series.push(point);
      if (byProduct[meta.code]) {
        byProduct[meta.code].points.push({
          label,
          year: row._id.year,
          month: row._id.month,
          revenue: row.total,
          growthPercent,
        });
      }
    }

    return { months, series, byProduct };
  }

  async getTopProductsLeaderboard(): Promise<TopProductsLeaderboard> {
    await this.syncProductLinks();
    const [profitability, density] = await Promise.all([
      this.getProfitability(),
      this.getCustomerDensity(),
    ]);

    const profitMap = new Map(profitability.rows.map((r) => [r.productId, r]));
    const densityMap = new Map(density.rows.map((r) => [r.productId, r]));

    const merged = profitability.rows.map((p) => ({
      productId: p.productId,
      productCode: p.productCode,
      productName: p.productName,
      salesVolume: densityMap.get(p.productId)?.activeCustomers ?? 0,
      revenueCollected: p.revenue,
      netProfit: p.netProfit,
    }));

    merged.sort((a, b) => b.revenueCollected - a.revenueCollected || b.salesVolume - a.salesVolume);

    const rows: TopProductLeaderboardRow[] = merged.map((r, i) => ({
      rank: i + 1,
      ...r,
    }));

    return { updatedAt: new Date().toISOString(), rows };
  }
}
