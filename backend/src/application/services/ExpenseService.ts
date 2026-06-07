import mongoose from 'mongoose';
import {
  CompanyExpenseModel,
  CompanyExpenseCategory,
  CompanyExpenseSource,
  CompanyExpenseAutomationKind,
} from '../../infrastructure/database/models/CompanyExpenseModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { MasterLedgerService } from './MasterLedgerService';

export interface CompanyExpenseRow {
  _id: string;
  amount: number;
  category: CompanyExpenseCategory;
  description: string;
  expenseDate: string;
  source: CompanyExpenseSource;
  developerId?: string;
  developerName?: string;
  projectId?: string;
  projectName?: string;
  projectTotalValue?: number;
  roiPercent?: number | null;
  automationKind?: CompanyExpenseAutomationKind;
  recordedBy: string;
  createdAt?: string;
}

export interface ExpenseSummaryByCategory {
  category: CompanyExpenseCategory;
  label: string;
  description: string;
  totalAmount: number;
  entryCount: number;
}

export interface CreateManualExpenseInput {
  category: CompanyExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  recordedByUserId: string;
  /** Optional link to a developer (wallet) for manual salary entries. */
  developerId?: string;
  /** Optional link to a project for marketing ROI (e.g. Facebook Ads → won project). */
  projectId?: string;
}

export interface MarketingRoiRow {
  expenseId: string;
  description: string;
  expenseDate: string;
  marketingSpend: number;
  projectId?: string;
  projectName?: string;
  projectValue: number;
  roiPercent: number | null;
  returnMultiple: number | null;
}

export interface MarketingRoiReport {
  rows: MarketingRoiRow[];
  totalMarketingSpend: number;
  attributedSpend: number;
  attributedProjectValue: number;
  overallRoiPercent: number | null;
  from?: string;
  to?: string;
}

const CATEGORY_META: Record<CompanyExpenseCategory, { label: string; description: string }> = {
  MARKETING: {
    label: 'Marketing',
    description: 'Digital advertising, campaigns, and brand spend (Facebook Ads, Google Ads, etc.).',
  },
  STAFF_SALARIES: {
    label: 'Salaries',
    description: 'Staff and developer pay. Automated when wallet payout is approved; manual entries can link a developer.',
  },
  INFRASTRUCTURE: {
    label: 'Infrastructure',
    description: 'Servers, hosting, office rent, utilities, and other project overhead (manual or from project expense updates).',
  },
};

const VALID_CATEGORIES: CompanyExpenseCategory[] = ['MARKETING', 'STAFF_SALARIES', 'INFRASTRUCTURE'];

function normalizeCategory(raw: string): CompanyExpenseCategory {
  if (raw === 'OPERATIONAL') return 'INFRASTRUCTURE';
  if (VALID_CATEGORIES.includes(raw as CompanyExpenseCategory)) return raw as CompanyExpenseCategory;
  throw new Error('Invalid expense category');
}

export function calcMarketingRoiPercent(spend: number, projectValue: number): number | null {
  if (!Number.isFinite(spend) || spend <= 0) return null;
  if (!Number.isFinite(projectValue) || projectValue <= 0) return null;
  return ((projectValue - spend) / spend) * 100;
}

function parseExpenseRange(from?: string, to?: string): { start?: Date; end?: Date } {
  let start: Date | undefined;
  let end: Date | undefined;
  if (from?.trim()) {
    start = new Date(from.trim());
    if (Number.isNaN(start.getTime())) start = undefined;
    else start.setHours(0, 0, 0, 0);
  }
  if (to?.trim()) {
    end = new Date(to.trim());
    if (Number.isNaN(end.getTime())) end = undefined;
    else end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

export class ExpenseService {
  private masterLedgerService = new MasterLedgerService();
  async createManual(input: CreateManualExpenseInput): Promise<CompanyExpenseRow> {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number');
    const uid = input.recordedByUserId.trim();
    if (!uid || !mongoose.Types.ObjectId.isValid(uid)) throw new Error('Invalid recorder');
    const desc = input.description?.trim();
    if (!desc) throw new Error('Description is required');
    const category = normalizeCategory(input.category);
    const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();
    if (Number.isNaN(expenseDate.getTime())) throw new Error('Invalid expense date');

    let developerOid: mongoose.Types.ObjectId | undefined;
    if (input.developerId?.trim()) {
      if (!mongoose.Types.ObjectId.isValid(input.developerId)) throw new Error('Invalid developer');
      const dev = await UserModel.findById(input.developerId).select('role name').lean();
      if (!dev || dev.role !== 'employee') throw new Error('Developer not found');
      developerOid = new mongoose.Types.ObjectId(input.developerId);
      if (category !== 'STAFF_SALARIES') {
        throw new Error('Developer link is only allowed for Salaries category');
      }
    }

    let projectOid: mongoose.Types.ObjectId | undefined;
    if (input.projectId?.trim()) {
      if (!mongoose.Types.ObjectId.isValid(input.projectId)) throw new Error('Invalid project');
      const project = await ProjectModel.findById(input.projectId).select('projectName').lean();
      if (!project) throw new Error('Project not found');
      projectOid = new mongoose.Types.ObjectId(input.projectId);
      if (category !== 'MARKETING') {
        throw new Error('Project link is only allowed for Marketing category');
      }
    }

    const doc = await CompanyExpenseModel.create({
      amount,
      category,
      description: desc,
      expenseDate,
      source: 'manual' as CompanyExpenseSource,
      recordedBy: new mongoose.Types.ObjectId(uid),
      ...(developerOid ? { developerId: developerOid } : {}),
      ...(projectOid ? { projectId: projectOid } : {}),
    });
    try {
      await this.masterLedgerService.recordCompanyExpense(String(doc._id));
    } catch {
      /* non-fatal */
    }
    return this.toRow(doc);
  }
  async logAutomatedStaffSalaryFromPayoutApproval(args: {
    amount: number;
    developerId: string;
    projectId: string;
    projectName: string;
    recordedByUserId: string;
  }): Promise<void> {
    const amount = Number(args.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!mongoose.Types.ObjectId.isValid(args.developerId) || !mongoose.Types.ObjectId.isValid(args.projectId)) return;

    const existing = await CompanyExpenseModel.findOne({
      developerId: new mongoose.Types.ObjectId(args.developerId),
      projectId: new mongoose.Types.ObjectId(args.projectId),
      automationKind: 'PAYOUT_APPROVAL',
      source: 'automated',
    })
      .select('_id')
      .lean();
    if (existing) return;

    const dev = await UserModel.findById(args.developerId).select('name').lean();
    const devName = (dev?.name as string)?.trim() || 'Developer';
    const desc = `Wallet payout approved — ${args.projectName} (${devName})`;
    const doc = await CompanyExpenseModel.create({
      amount,
      category: 'STAFF_SALARIES',
      description: desc,
      expenseDate: new Date(),
      source: 'automated',
      developerId: new mongoose.Types.ObjectId(args.developerId),
      projectId: new mongoose.Types.ObjectId(args.projectId),
      automationKind: 'PAYOUT_APPROVAL',
      recordedBy: new mongoose.Types.ObjectId(args.recordedByUserId),
    });
    try {
      await this.masterLedgerService.recordCompanyExpense(String(doc._id));
    } catch {
      /* non-fatal */
    }
  }

  /** Log update-ticket worker payout as a project-linked expense when admin approves completed work. */
  async logAutomatedUpdatePayoutExpense(args: {
    amount: number;
    developerId: string;
    projectId: string;
    projectName: string;
    updateTicketId: string;
    ticketId: string;
    ticketTitle: string;
    quotedPrice?: number;
    recordedByUserId: string;
  }): Promise<void> {
    const amount = Number(args.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (
      !mongoose.Types.ObjectId.isValid(args.developerId) ||
      !mongoose.Types.ObjectId.isValid(args.projectId) ||
      !mongoose.Types.ObjectId.isValid(args.updateTicketId) ||
      !mongoose.Types.ObjectId.isValid(args.recordedByUserId)
    ) {
      return;
    }

    const updateOid = new mongoose.Types.ObjectId(args.updateTicketId);
    const existing = await CompanyExpenseModel.findOne({
      updateTicketId: updateOid,
      automationKind: 'UPDATE_PAYOUT_APPROVAL',
      source: 'automated',
    })
      .select('_id')
      .lean();
    if (existing) return;

    const dev = await UserModel.findById(args.developerId).select('name').lean();
    const devName = (dev?.name as string)?.trim() || 'Worker';
    const quoted =
      args.quotedPrice != null && Number.isFinite(Number(args.quotedPrice)) && Number(args.quotedPrice) > 0
        ? ` Customer price Rs. ${Number(args.quotedPrice).toLocaleString()};`
        : '';
    const desc = `Update worker payout — ${args.ticketId}: ${args.ticketTitle} (${devName}).${quoted} Project: ${args.projectName}`;

    const doc = await CompanyExpenseModel.create({
      amount,
      category: 'STAFF_SALARIES',
      description: desc,
      expenseDate: new Date(),
      source: 'automated',
      developerId: new mongoose.Types.ObjectId(args.developerId),
      projectId: new mongoose.Types.ObjectId(args.projectId),
      updateTicketId: updateOid,
      automationKind: 'UPDATE_PAYOUT_APPROVAL',
      recordedBy: new mongoose.Types.ObjectId(args.recordedByUserId),
    });

    await ProjectModel.findByIdAndUpdate(args.projectId, { $inc: { expenses: amount } });

    try {
      await this.masterLedgerService.recordCompanyExpense(String(doc._id));
    } catch {
      /* non-fatal */
    }
  }

  /**
   * Month-end salary disbursement: base + wallet, logged once per developer per YYYY-MM period.
   */
  async logMonthlyPayrollSalary(args: {
    developerId: string;
    developerName: string;
    baseSalary: number;
    walletPortion: number;
    totalPaid: number;
    payrollPeriod: string;
    recordedByUserId: string;
  }): Promise<string | null> {
    const total = Number(args.totalPaid);
    if (!Number.isFinite(total) || total <= 0) return null;
    if (!mongoose.Types.ObjectId.isValid(args.developerId)) return null;
    const period = args.payrollPeriod.trim();
    if (!/^\d{4}-\d{2}$/.test(period)) return null;

    const existing = await CompanyExpenseModel.findOne({
      developerId: new mongoose.Types.ObjectId(args.developerId),
      automationKind: 'MONTHLY_PAYROLL',
      payrollPeriod: period,
      source: 'automated',
    })
      .select('_id')
      .lean();
    if (existing) return String(existing._id);

    const desc = `Monthly salary ${period} — ${args.developerName} (base Rs. ${args.baseSalary.toLocaleString()} + wallet Rs. ${args.walletPortion.toLocaleString()})`;
    const doc = await CompanyExpenseModel.create({
      amount: total,
      category: 'STAFF_SALARIES',
      description: desc,
      expenseDate: new Date(),
      source: 'automated',
      developerId: new mongoose.Types.ObjectId(args.developerId),
      automationKind: 'MONTHLY_PAYROLL',
      payrollPeriod: period,
      recordedBy: new mongoose.Types.ObjectId(args.recordedByUserId),
    });
    return String(doc._id);
  }

  /**
   * When project "other expenses" (infrastructure overhead) increases, log the delta automatically.
   */
  async logAutomatedInfrastructureFromProjectExpense(args: {
    projectId: string;
    projectName: string;
    deltaAmount: number;
    recordedByUserId: string;
  }): Promise<void> {
    const delta = Number(args.deltaAmount);
    if (!Number.isFinite(delta) || delta <= 0) return;
    if (!mongoose.Types.ObjectId.isValid(args.projectId)) return;

    const desc = `Project infrastructure / overhead — ${args.projectName} (+Rs. ${delta.toLocaleString()})`;
    const doc = await CompanyExpenseModel.create({
      amount: delta,
      category: 'INFRASTRUCTURE',
      description: desc,
      expenseDate: new Date(),
      source: 'automated',
      projectId: new mongoose.Types.ObjectId(args.projectId),
      automationKind: 'PROJECT_OVERHEAD',
      recordedBy: new mongoose.Types.ObjectId(args.recordedByUserId),
    });
    try {
      await this.masterLedgerService.recordCompanyExpense(String(doc._id));
    } catch {
      /* non-fatal */
    }
  }

  async list(limit = 200, category?: string): Promise<CompanyExpenseRow[]> {
    const query: Record<string, unknown> = {};
    if (category?.trim()) {
      const cat = normalizeCategory(category.trim());
      if (cat === 'INFRASTRUCTURE') {
        query.category = { $in: ['INFRASTRUCTURE', 'OPERATIONAL'] };
      } else {
        query.category = cat;
      }
    }
    const docs = await CompanyExpenseModel.find(query)
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(Math.min(500, Math.max(1, limit)))
      .populate('developerId', 'name')
      .populate('projectId', 'projectName totalValue')
      .lean();
    return docs.map((d) => this.leanToRow(d as Record<string, unknown>));
  }

  async getMarketingRoi(filters?: { from?: string; to?: string }): Promise<MarketingRoiReport> {
    const { start, end } = parseExpenseRange(filters?.from, filters?.to);
    const query: Record<string, unknown> = { category: 'MARKETING' };
    if (start || end) {
      const range: Record<string, Date> = {};
      if (start) range.$gte = start;
      if (end) range.$lte = end;
      query.expenseDate = range;
    }

    const docs = await CompanyExpenseModel.find(query)
      .sort({ expenseDate: -1 })
      .populate('projectId', 'projectName totalValue')
      .lean();

    const rows: MarketingRoiRow[] = [];
    let totalMarketingSpend = 0;
    let attributedSpend = 0;
    let attributedProjectValue = 0;

    for (const doc of docs) {
      const spend = Number(doc.amount) || 0;
      totalMarketingSpend += spend;
      const project = doc.projectId as { _id?: unknown; projectName?: string; totalValue?: number } | null;
      const projectValue = project && typeof project === 'object' ? Number(project.totalValue) || 0 : 0;
      const projectId =
        project && typeof project === 'object' && project._id
          ? String(project._id)
          : doc.projectId
            ? String(doc.projectId)
            : undefined;
      const projectName = project?.projectName;

      if (projectId && projectValue > 0) {
        attributedSpend += spend;
        attributedProjectValue += projectValue;
      }

      const roiPercent = calcMarketingRoiPercent(spend, projectValue);
      const returnMultiple = spend > 0 && projectValue > 0 ? projectValue / spend : null;

      rows.push({
        expenseId: String(doc._id),
        description: String(doc.description || ''),
        expenseDate: new Date(doc.expenseDate).toISOString(),
        marketingSpend: spend,
        projectId,
        projectName,
        projectValue,
        roiPercent,
        returnMultiple,
      });
    }

    const overallRoiPercent =
      attributedSpend > 0 && attributedProjectValue > 0
        ? calcMarketingRoiPercent(attributedSpend, attributedProjectValue)
        : null;

    return {
      rows,
      totalMarketingSpend,
      attributedSpend,
      attributedProjectValue,
      overallRoiPercent,
      from: start?.toISOString(),
      to: end?.toISOString(),
    };
  }

  async summary(): Promise<ExpenseSummaryByCategory[]> {
    const agg = await CompanyExpenseModel.aggregate<{ _id: string; t: number; c: number }>([
      { $group: { _id: '$category', t: { $sum: '$amount' }, c: { $sum: 1 } } },
    ]);
    const byCat: Record<string, { total: number; count: number }> = {};
    for (const a of agg) {
      const key = a._id === 'OPERATIONAL' ? 'INFRASTRUCTURE' : a._id;
      if (!byCat[key]) byCat[key] = { total: 0, count: 0 };
      byCat[key].total += a.t;
      byCat[key].count += a.c;
    }
    return VALID_CATEGORIES.map((category) => {
      const m = CATEGORY_META[category];
      const row = byCat[category];
      return {
        category,
        label: m.label,
        description: m.description,
        totalAmount: row?.total ?? 0,
        entryCount: row?.count ?? 0,
      };
    });
  }

  private toRow(doc: { toObject: () => Record<string, unknown>; _id: unknown }): CompanyExpenseRow {
    return this.leanToRow(doc.toObject() as Record<string, unknown>);
  }

  private leanToRow(o: Record<string, unknown>): CompanyExpenseRow {
    const id = o._id as { toString: () => string };
    const devPop = o.developerId as { _id?: unknown; name?: string } | null;
    let developerId: string | undefined;
    let developerName: string | undefined;
    if (devPop && typeof devPop === 'object' && devPop._id) {
      developerId = (devPop._id as { toString: () => string }).toString();
      developerName = devPop.name as string | undefined;
    } else if (o.developerId) {
      developerId = String(o.developerId);
    }

    const projPop = o.projectId as { _id?: unknown; projectName?: string; totalValue?: number } | null;
    let projectId: string | undefined;
    let projectName: string | undefined;
    let projectTotalValue: number | undefined;
    if (projPop && typeof projPop === 'object' && projPop._id) {
      projectId = (projPop._id as { toString: () => string }).toString();
      projectName = projPop.projectName as string | undefined;
      projectTotalValue = Number(projPop.totalValue) || 0;
    } else if (o.projectId) {
      projectId = String(o.projectId);
    }

    const amount = Number(o.amount) || 0;
    const rawCat = String(o.category || '');
    const category = rawCat === 'OPERATIONAL' ? 'INFRASTRUCTURE' : (rawCat as CompanyExpenseCategory);
    const roiPercent =
      category === 'MARKETING' && projectTotalValue != null && projectTotalValue > 0
        ? calcMarketingRoiPercent(amount, projectTotalValue)
        : null;

    return {
      _id: id && typeof id.toString === 'function' ? id.toString() : String(o._id),
      amount,
      category,
      description: String(o.description || ''),
      expenseDate: (o.expenseDate as Date).toISOString(),
      source: o.source as CompanyExpenseSource,
      developerId,
      developerName,
      projectId,
      projectName,
      projectTotalValue,
      roiPercent,
      automationKind: o.automationKind as CompanyExpenseAutomationKind | undefined,
      recordedBy: String(o.recordedBy),
      createdAt: o.createdAt ? new Date(o.createdAt as Date).toISOString() : undefined,
    };
  }
}
