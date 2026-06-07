import mongoose from 'mongoose';
import type {
  CustomerEngagementSummary,
  CustomerFinancialSummary,
  CustomerListSummary,
  CustomerProfile360,
  CustomerProjectHistoryRow,
  CustomerStaffActivityEntry,
} from '../../domain/entities/CustomerProfile';
import { BirthdayCardModel } from '../../infrastructure/database/models/BirthdayCardModel';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { CustomerRequirementModel } from '../../infrastructure/database/models/CustomerRequirementModel';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { InteractionModel } from '../../infrastructure/database/models/InteractionModel';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { ProjectTaskModel } from '../../infrastructure/database/models/ProjectTaskModel';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';
import { ReminderModel } from '../../infrastructure/database/models/ReminderModel';
import { ProductModel } from '../../infrastructure/database/models/ProductModel';
import { FinancialReportService } from './FinancialReportService';
import { ProductService } from './ProductService';
import { extractMongoId } from '../../infrastructure/database/mongoId';

const financialReportService = new FinancialReportService();
const productService = new ProductService();

function isoDate(d: Date | undefined | null): string | undefined {
  if (!d) return undefined;
  return new Date(d).toISOString();
}

function userLabel(
  user: { name?: string; email?: string } | null | undefined,
  fallbackId?: string
): string {
  if (user?.name?.trim()) return user.name.trim();
  if (user?.email?.trim()) return user.email.trim();
  return fallbackId ? `Staff #${fallbackId.slice(-6)}` : 'Staff';
}

function sumDeveloperPayouts(payouts: unknown): number {
  if (payouts == null) return 0;
  if (payouts instanceof Map) {
    let s = 0;
    payouts.forEach((v) => {
      const n = Number(v);
      if (Number.isFinite(n)) s += n;
    });
    return s;
  }
  if (typeof payouts === 'object') {
    return Object.values(payouts as Record<string, unknown>).reduce<number>((s, v) => {
      const n = Number(v);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
  }
  return 0;
}

function projectNetProfit(p: {
  totalValue?: number;
  expenses?: number;
  assignedEmployeePayouts?: unknown;
}): number {
  const totalValue = Number(p.totalValue) || 0;
  const expenses = Math.max(0, Number(p.expenses) || 0);
  const payouts = sumDeveloperPayouts(p.assignedEmployeePayouts);
  return totalValue - payouts - expenses;
}

function serviceLabelFromProject(p: {
  productId?: { name?: string; code?: string } | null;
  systemType?: string;
  projectName?: string;
}): string {
  const product = p.productId as { name?: string; code?: string } | null;
  if (product?.name) return product.name;
  if (product?.code) return product.code;
  if (p.systemType?.trim()) return p.systemType.trim();
  return p.projectName?.trim() || 'Project';
}

export class CustomerProfileService {
  async getProfile360(clientId: string): Promise<CustomerProfile360 | null> {
    if (!mongoose.Types.ObjectId.isValid(clientId)) return null;

    const customer = await CustomerModel.findById(clientId).populate('productId', 'name code').lean();
    if (!customer) return null;

    await this.syncClientProductLinks(clientId, customer).catch((err) => {
      console.warn('[CustomerProfileService] syncClientProductLinks failed:', err);
    });

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const projects = await ProjectModel.find({ clientId: clientOid })
      .populate('productId', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    const projectHistory = this.mapProjectHistory(projects, {
      productId: customer.productId as { name?: string; code?: string } | null | undefined,
      serviceCategories: customer.serviceCategories,
    });
    const financialSummary = await this.buildFinancialSummary(clientId, projects, clientOid);
    const servicesPurchased = this.uniqueServices(projects);

    const inquiryIds = await this.resolveInquiryIds(customer.inquiryId, customer.phoneNumber);
    const inquiryOidList = inquiryIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const [proposalsSent, meetingsFromInteractions, meetingsFromReminders, birthdayCardsSent, callsLogged, interactionsTotal] =
      await Promise.all([
        inquiryOidList.length > 0
          ? ProposalModel.countDocuments({ inquiryId: { $in: inquiryOidList } })
          : Promise.resolve(0),
        InteractionModel.countDocuments({ customerRef: clientOid, type: 'MEETING' }),
        inquiryOidList.length > 0
          ? ReminderModel.countDocuments({ inquiryId: { $in: inquiryOidList }, type: 'meeting' })
          : Promise.resolve(0),
        BirthdayCardModel.countDocuments({
          subjectType: 'customer',
          subjectId: clientOid,
          campaignType: 'birthday',
          sentAt: { $exists: true, $ne: null },
        }),
        InteractionModel.countDocuments({ customerRef: clientOid, type: 'CALL' }),
        InteractionModel.countDocuments({ customerRef: clientOid }),
      ]);

    const engagement: CustomerEngagementSummary = {
      proposalsSent,
      meetingsHeld: meetingsFromInteractions + meetingsFromReminders,
      birthdayCardsSent,
      callsLogged,
      interactionsTotal,
    };

    const activityLog = await this.buildActivityLog(clientOid, projects, projectHistory);

    return {
      clientId,
      clientName: customer.name,
      customerId: customer.customerId,
      servicesPurchased,
      projectHistory,
      financialSummary,
      engagement,
      activityLog,
    };
  }

  async getListSummaries(clientIds: string[]): Promise<Record<string, CustomerListSummary>> {
    const validIds = clientIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) return {};

    const oids = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const projects = await ProjectModel.find({ clientId: { $in: oids } })
      .populate('productId', 'name code')
      .select('clientId totalValue expenses assignedEmployeePayouts productId systemType projectName')
      .lean();

    const byClient: Record<string, typeof projects> = {};
    for (const p of projects) {
      const cid = String(p.clientId);
      if (!byClient[cid]) byClient[cid] = [];
      byClient[cid].push(p);
    }

    const [paymentAggs, invoicePaidAggs] = await Promise.all([
      PaymentTransactionModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
        { $match: { clientId: { $in: oids } } },
        { $group: { _id: '$clientId', total: { $sum: '$amount' } } },
      ]),
      InvoiceModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
        {
          $match: {
            clientId: { $in: oids },
            status: 'paid',
            $or: [{ transactionId: { $exists: false } }, { transactionId: null }],
          },
        },
        { $group: { _id: '$clientId', total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const paidByClient: Record<string, number> = {};
    for (const row of paymentAggs) paidByClient[String(row._id)] = Number(row.total) || 0;
    for (const row of invoicePaidAggs) {
      const id = String(row._id);
      paidByClient[id] = (paidByClient[id] || 0) + (Number(row.total) || 0);
    }

    const out: Record<string, CustomerListSummary> = {};
    for (const id of validIds) {
      const clientProjects = byClient[id] || [];
      const totalRevenue = clientProjects.reduce((s, p) => s + (Number(p.totalValue) || 0), 0);
      const totalProfit = clientProjects.reduce((s, p) => s + projectNetProfit(p), 0);
      out[id] = {
        servicesPurchased: this.uniqueServices(clientProjects),
        projectCount: clientProjects.length,
        totalRevenue,
        paidAmount: paidByClient[id] || 0,
        totalProfit,
      };
    }
    return out;
  }

  private async syncClientProductLinks(
    clientId: string,
    customer: {
      productId?: unknown;
      inquiryId?: mongoose.Types.ObjectId;
      serviceCategories?: string[];
    }
  ): Promise<void> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    let resolvedProductId = extractMongoId(customer.productId);

    const hints: (string | undefined)[] = [...(customer.serviceCategories || [])];
    if (customer.inquiryId) {
      const inquiry = await InquiryModel.findById(customer.inquiryId).lean();
      hints.unshift(
        inquiry?.businessModel,
        inquiry?.projectDescription,
        ...(inquiry?.requiredFeatures || [])
      );
      const proposal = await ProposalModel.findOne({ inquiryId: customer.inquiryId })
        .sort({ createdAt: -1 })
        .select('projectName projectDescription')
        .lean();
      if (proposal) {
        hints.unshift(proposal.projectName, proposal.projectDescription);
      }
    }

    if (!resolvedProductId) {
      resolvedProductId = await productService.resolveProductIdFromHints(hints);
      if (resolvedProductId) {
        await CustomerModel.findByIdAndUpdate(clientId, {
          productId: new mongoose.Types.ObjectId(resolvedProductId),
        });
      }
    }

    if (!resolvedProductId || !mongoose.Types.ObjectId.isValid(resolvedProductId)) return;

    const productDoc = await ProductModel.findById(resolvedProductId).select('name code').lean();
    const systemType = productDoc?.name || productDoc?.code;
    if (!systemType) return;

    await ProjectModel.updateMany(
      {
        clientId: clientOid,
        $or: [
          { productId: { $exists: false } },
          { productId: null },
          { systemType: { $exists: false } },
          { systemType: null },
          { systemType: '' },
        ],
      },
      {
        $set: {
          productId: new mongoose.Types.ObjectId(resolvedProductId),
          systemType,
        },
      }
    );
  }

  private mapProjectHistory(
    projects: {
      _id: unknown;
      projectName: string;
      productId?: unknown;
      systemType?: string;
      status: string;
      totalValue: number;
      startDate?: Date;
      endDate?: Date;
    }[],
    customer?: {
      productId?: { name?: string; code?: string } | null;
      serviceCategories?: string[];
    }
  ): CustomerProjectHistoryRow[] {
    return projects.map((p) => {
      const product = p.productId as { name?: string; code?: string } | null;
      const customerProduct = customer?.productId as { name?: string; code?: string } | null;
      const categoryFallback = customer?.serviceCategories?.[0];
      return {
        projectId: String(p._id),
        projectName: p.projectName,
        productName: product?.name || customerProduct?.name || p.systemType || categoryFallback,
        productCode: product?.code || customerProduct?.code,
        systemType: p.systemType || product?.name || product?.code || customerProduct?.name || categoryFallback,
        status: String(p.status),
        totalValue: Number(p.totalValue) || 0,
        startDate: isoDate(p.startDate),
        endDate: isoDate(p.endDate),
      };
    });
  }

  private uniqueServices(
    projects: {
      productId?: unknown;
      systemType?: string;
      projectName?: string;
    }[]
  ): string[] {
    const set = new Set<string>();
    for (const p of projects) {
      set.add(
        serviceLabelFromProject({
          productId: p.productId as { name?: string; code?: string } | null,
          systemType: p.systemType,
          projectName: p.projectName,
        })
      );
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  private async buildFinancialSummary(
    clientId: string,
    projects: { totalValue?: number; expenses?: number; assignedEmployeePayouts?: unknown }[],
    clientOid: mongoose.Types.ObjectId
  ): Promise<CustomerFinancialSummary> {
    const statement = await financialReportService.getClientStatement(clientId);

    const invoices = await InvoiceModel.find({ clientId: clientOid })
      .select('totalAmount status transactionId')
      .lean();
    let paidInvoiceTotal = 0;
    let pendingInvoiceTotal = 0;
    let paidInvoiceStandalone = 0;
    for (const inv of invoices) {
      const amt = Number(inv.totalAmount) || 0;
      if (inv.status === 'paid') {
        paidInvoiceTotal += amt;
        if (!inv.transactionId) paidInvoiceStandalone += amt;
      } else if (inv.status === 'pending' || inv.status === 'sent') {
        pendingInvoiceTotal += amt;
      }
    }

    const txPaid = statement?.totalPaid ?? 0;
    const paidAmount = txPaid + paidInvoiceStandalone;
    const totalProfit = projects.reduce((s, p) => s + projectNetProfit(p), 0);

    return {
      totalRevenue: statement?.totalContractValue ?? 0,
      paidAmount,
      outstandingBalance: statement?.totalRemainingBalance ?? 0,
      totalProfit,
      paidInvoiceTotal,
      pendingInvoiceTotal,
    };
  }

  private async resolveInquiryIds(
    primaryInquiryId: mongoose.Types.ObjectId | undefined,
    phoneNumber: string
  ): Promise<string[]> {
    const ids = new Set<string>();
    if (primaryInquiryId) ids.add(String(primaryInquiryId));

    const normalizedPhone = phoneNumber?.replace(/\D/g, '').trim();
    if (normalizedPhone.length >= 9) {
      const tail = normalizedPhone.slice(-9);
      const inquiries = await InquiryModel.find({
        phoneNumber: { $regex: tail },
      })
        .select('_id')
        .lean();
      for (const inq of inquiries) ids.add(String(inq._id));
    }
    return [...ids];
  }

  private async buildActivityLog(
    clientOid: mongoose.Types.ObjectId,
    projects: { _id: unknown; projectName: string }[],
    projectHistory: CustomerProjectHistoryRow[]
  ): Promise<CustomerStaffActivityEntry[]> {
    const projectIds = projects.map((p) => p._id as mongoose.Types.ObjectId);
    const projectNameById: Record<string, string> = {};
    for (const row of projectHistory) projectNameById[row.projectId] = row.projectName;

    const entries: CustomerStaffActivityEntry[] = [];

    const interactions = await InteractionModel.find({ customerRef: clientOid })
      .populate('createdBy', 'name email')
      .sort({ occurredAt: -1 })
      .limit(40)
      .lean();

    for (const row of interactions) {
      const staff = row.createdBy as { name?: string; email?: string; _id?: unknown } | null;
      const staffId = staff?._id ? String(staff._id) : undefined;
      entries.push({
        id: `interaction-${String(row._id)}`,
        occurredAt: isoDate(row.occurredAt) || new Date().toISOString(),
        staffName: userLabel(staff, staffId),
        action: String(row.type).replace(/_/g, ' ').toLowerCase(),
        summary: row.summary,
      });
    }

    if (projectIds.length > 0) {
      const tasks = await ProjectTaskModel.find({ projectId: { $in: projectIds } })
        .populate('createdBy', 'name email')
        .populate('completedBy', 'name email')
        .sort({ updatedAt: -1 })
        .limit(30)
        .lean();

      for (const task of tasks) {
        const pid = String(task.projectId);
        const creator = task.createdBy as { name?: string; email?: string; _id?: unknown } | null;
        entries.push({
          id: `task-created-${String(task._id)}`,
          occurredAt: isoDate(task.createdAt) || new Date().toISOString(),
          staffName: userLabel(creator, creator?._id ? String(creator._id) : undefined),
          action: 'task created',
          summary: task.title,
          projectId: pid,
          projectName: projectNameById[pid],
        });

        if (task.completed && task.completedAt) {
          const completer = task.completedBy as { name?: string; email?: string; _id?: unknown } | null;
          entries.push({
            id: `task-completed-${String(task._id)}`,
            occurredAt: isoDate(task.completedAt) || new Date().toISOString(),
            staffName: userLabel(completer, completer?._id ? String(completer._id) : undefined),
            action: 'task completed',
            summary: task.title,
            projectId: pid,
            projectName: projectNameById[pid],
          });
        }
      }
    }

    const requirements = await CustomerRequirementModel.find({ customerRef: clientOid })
      .populate('capturedBy', 'name email')
      .sort({ capturedAt: -1 })
      .limit(20)
      .lean();

    for (const req of requirements) {
      const staff = req.capturedBy as { name?: string; email?: string; _id?: unknown } | null;
      const projId = req.projectRef ? String(req.projectRef) : undefined;
      entries.push({
        id: `requirement-${String(req._id)}`,
        occurredAt: isoDate(req.capturedAt) || new Date().toISOString(),
        staffName: userLabel(staff, staff?._id ? String(staff._id) : undefined),
        action: 'requirement logged',
        summary: req.title,
        projectId: projId,
        projectName: projId ? projectNameById[projId] : undefined,
      });
    }

    entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return entries.slice(0, 50);
  }
}
