import mongoose from 'mongoose';
import { Project } from '../../domain/entities/Project';
import {
  normalizeProjectStatus,
  isProjectInDevelopment,
  type ProjectLifecycleStatus,
} from '../../domain/projectLifecycle';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import {
  DeveloperWalletLedgerModel,
  ensureWalletLedgerWalletStatusMigrated,
} from '../../infrastructure/database/models/DeveloperWalletLedgerModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { StaffAssignmentModel } from '../../infrastructure/database/models/StaffAssignmentModel';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { PaymentNotificationService } from './PaymentNotificationService';
import { ExpenseService } from './ExpenseService';

export interface CreateProjectInput {
  clientId: string;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  expenses?: number;
  startDate?: string;
  endDate?: string;
  status?: ProjectLifecycleStatus;
}

export interface UpdateProjectInput {
  projectName?: string;
  description?: string;
  systemType?: string;
  totalValue?: number;
  expenses?: number;
  startDate?: string;
  endDate?: string;
  status?: ProjectLifecycleStatus;
  assignedEmployees?: string[];
  assignedEmployeePayouts?: Record<string, number>;
}

export interface ListProjectsFilters {
  clientId?: string;
  status?: string;
  search?: string;
  /** When set, only projects that include this user in `assignedEmployees`. */
  assignedUserId?: string;
}

export type PayoutReleaseStatus = 'accruing' | 'submitted' | 'released';

export interface DeveloperPendingEarningsItem {
  projectId: string;
  projectName: string;
  amount: number;
  releaseStatus: PayoutReleaseStatus;
  /** Linked proposal for PDF (via customer → inquiry), when found. */
  proposalId?: string | null;
}

export interface DeveloperWalletTransactionRow {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  /** Wallet ledger status: Pending until admin approval, then Available (credited). */
  displayStatus: 'Pending' | 'Available';
  walletStatus: 'Pending' | 'Available';
  amount: number;
}

export interface DeveloperPendingEarnings {
  totalPending: number;
  availableWalletBalance: number;
  /** Sum of admin-approved payouts credited this calendar month. */
  totalEarnedThisMonth: number;
  /** Sum of admin-approved payouts credited this calendar year. */
  totalEarnedThisYear: number;
  items: DeveloperPendingEarningsItem[];
  transactions: DeveloperWalletTransactionRow[];
  /** Wallet table (`developerwalletledgers`): balance + ledger rows. */
  wallet: { availableBalance: number; ledger: DeveloperWalletTransactionRow[] };
  /** Staff_Assignments rows for this developer (same data as `items`). */
  staffAssignments: DeveloperPendingEarningsItem[];
}

export interface PendingPayoutApprovalRow {
  projectId: string;
  projectName: string;
  developerId: string;
  developerName: string;
  developerEmail?: string;
  amount: number;
}

const ASSIGNMENT_SMS = (projectName: string, amount: number) =>
  amount > 0
    ? `Niolla: Assigned to "${projectName}". Agreed payout LKR ${amount.toLocaleString()}. Open the app → Dashboard for proposal PDF & details.`
    : `Niolla: Assigned to "${projectName}". Open the app → Dashboard for details.`;

function assignmentInAppMessage(projectName: string, amount: number): string {
  const payout =
    amount > 0
      ? ` Your agreed payout is LKR ${amount.toLocaleString()}.`
      : '';
  return `You were assigned to "${projectName}".${payout} Open Dashboard → Main wallet overview: use View Proposal to download the client proposal PDF, and see this payout under Pending Earnings and Your projects.`;
}

export class ProjectService {
  private paymentNotificationService = new PaymentNotificationService();
  private expenseService = new ExpenseService();

  async create(data: CreateProjectInput): Promise<Project> {
    const doc = await ProjectModel.create({
      clientId: data.clientId,
      projectName: data.projectName.trim(),
      description: data.description?.trim() || undefined,
      systemType: data.systemType?.trim() || undefined,
      totalValue: Number(data.totalValue),
      expenses: data.expenses !== undefined ? Math.max(0, Number(data.expenses)) : 0,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      status: data.status !== undefined ? normalizeProjectStatus(data.status) : 'unassigned',
    });
    return this.toProject(doc);
  }

  async findById(id: string): Promise<Project | null> {
    const doc = await ProjectModel.findById(id).populate('clientId', 'name customerId');
    return doc ? this.toProject(doc) : null;
  }

  async findByClientId(clientId: string): Promise<Project[]> {
    const docs = await ProjectModel.find({ clientId }).populate('clientId', 'name customerId').sort({ createdAt: -1 });
    return docs.map((d) => this.toProject(d));
  }

  async findAll(filters?: ListProjectsFilters): Promise<Project[]> {
    const query: Record<string, unknown> = {};
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.status) query.status = filters.status;
    if (filters?.assignedUserId?.trim()) {
      const uid = filters.assignedUserId.trim();
      if (mongoose.Types.ObjectId.isValid(uid)) {
        query.assignedEmployees = new mongoose.Types.ObjectId(uid);
      }
    }
    if (filters?.search?.trim()) {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [{ projectName: searchRegex }, { description: searchRegex }, { systemType: searchRegex }];
    }
    const docs = await ProjectModel.find(query).populate('clientId', 'name customerId').sort({ createdAt: -1 });
    return docs.map((d) => this.toProject(d));
  }

  /**
   * Pending = agreed payout on active projects not yet released to wallet.
   * Includes accruing (working) and submitted (awaiting admin approval).
   */
  async getPendingDeveloperEarnings(userId: string): Promise<DeveloperPendingEarnings> {
    const uid = userId.trim();
    const empty: DeveloperPendingEarnings = {
      totalPending: 0,
      availableWalletBalance: 0,
      totalEarnedThisMonth: 0,
      totalEarnedThisYear: 0,
      items: [],
      transactions: [],
      wallet: { availableBalance: 0, ledger: [] },
      staffAssignments: [],
    };
    if (!uid) return empty;

    const walletUser = await UserModel.findById(uid).select('walletBalance').lean();
    const availableWalletBalance = Number(walletUser?.walletBalance ?? 0) || 0;

    const items: DeveloperPendingEarningsItem[] = [];
    let totalPending = 0;
    let transactions: DeveloperWalletTransactionRow[] = [];
    let totalEarnedThisMonth = 0;
    let totalEarnedThisYear = 0;

    if (mongoose.Types.ObjectId.isValid(uid)) {
      await ensureWalletLedgerWalletStatusMigrated();
      const devOid = new mongoose.Types.ObjectId(uid);
      await this.syncStaffAssignmentsForDeveloper(uid);

      const assignRows = await StaffAssignmentModel.find({
        userId: devOid,
        workflowStatus: { $in: ['InProgress', 'ReviewRequested'] },
      })
        .sort({ projectName: 1 })
        .lean();

      for (const row of assignRows) {
        const amount = Number(row.agreedPayout) || 0;
        if (amount <= 0) continue;
        const releaseStatus: PayoutReleaseStatus =
          row.workflowStatus === 'ReviewRequested' ? 'submitted' : 'accruing';
        const projectId = row.projectId.toString();
        const clientId = row.clientId.toString();
        const proposalId = await ProjectService.resolveProposalIdForProject(clientId, row.projectName);
        items.push({
          projectId,
          projectName: row.projectName,
          amount,
          releaseStatus,
          proposalId,
        });
        totalPending += amount;
      }

      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startYear = new Date(now.getFullYear(), 0, 1);
      const creditedMatch = {
        developerId: devOid,
        approvedAt: { $gte: startMonth as Date },
        $or: [{ walletStatus: 'Available' }, { status: 'approved' }],
      };
      const creditedMatchYear = {
        developerId: devOid,
        approvedAt: { $gte: startYear as Date },
        $or: [{ walletStatus: 'Available' }, { status: 'approved' }],
      };

      const [ledgerRows, monthAgg, yearAgg] = await Promise.all([
        DeveloperWalletLedgerModel.find({ developerId: devOid }).sort({ submittedAt: -1 }).limit(100).lean(),
        DeveloperWalletLedgerModel.aggregate<{ t: number }>([
          { $match: creditedMatch },
          { $group: { _id: null, t: { $sum: '$amount' } } },
        ]),
        DeveloperWalletLedgerModel.aggregate<{ t: number }>([
          { $match: creditedMatchYear },
          { $group: { _id: null, t: { $sum: '$amount' } } },
        ]),
      ]);

      totalEarnedThisMonth = Number(monthAgg[0]?.t ?? 0) || 0;
      totalEarnedThisYear = Number(yearAgg[0]?.t ?? 0) || 0;

      transactions = ledgerRows.map((row) => {
        const approvedAt = row.approvedAt ? new Date(row.approvedAt) : null;
        const submittedAt = new Date(row.submittedAt);
        const walletStatus: 'Pending' | 'Available' =
          row.walletStatus === 'Available' || row.status === 'approved' ? 'Available' : 'Pending';
        const isAvailable = walletStatus === 'Available';
        return {
          id: (row._id as mongoose.Types.ObjectId).toString(),
          date: (isAvailable && approvedAt ? approvedAt : submittedAt).toISOString(),
          projectId: row.projectId.toString(),
          projectName: row.projectName,
          displayStatus: walletStatus,
          walletStatus,
          amount: Number(row.amount) || 0,
        };
      });
    }

    return {
      totalPending,
      availableWalletBalance,
      totalEarnedThisMonth,
      totalEarnedThisYear,
      items,
      transactions,
      wallet: { availableBalance: availableWalletBalance, ledger: transactions },
      staffAssignments: items,
    };
  }

  /** Keeps `Staff_Assignments` in sync with the project’s assignment + payout state. */
  private async syncStaffAssignmentsForProject(projectId: string): Promise<void> {
    const doc = await ProjectModel.findById(projectId)
      .select('projectName status clientId assignedEmployees assignedEmployeePayouts assignedEmployeePayoutRelease')
      .lean();
    if (!doc || !isProjectInDevelopment(String(doc.status))) {
      await StaffAssignmentModel.deleteMany({ projectId: new mongoose.Types.ObjectId(projectId) });
      return;
    }
    const pid = doc._id as mongoose.Types.ObjectId;
    const clientOid = doc.clientId as mongoose.Types.ObjectId;
    await StaffAssignmentModel.deleteMany({ projectId: pid });
    const assignees = doc.assignedEmployees || [];
    for (const empOid of assignees) {
      const uid = empOid.toString();
      const amount = ProjectService.payoutAmountForUser(doc.assignedEmployeePayouts, uid);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const release = ProjectService.payoutReleaseForUser(doc.assignedEmployeePayoutRelease, uid);
      const workflowStatus =
        release === 'released'
          ? 'CreditedToWallet'
          : release === 'submitted'
            ? 'ReviewRequested'
            : 'InProgress';
      await StaffAssignmentModel.create({
        userId: empOid,
        projectId: pid,
        clientId: clientOid,
        projectName: doc.projectName as string,
        agreedPayout: amount,
        workflowStatus,
      });
    }
  }

  private async syncStaffAssignmentsForDeveloper(userId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    const assigneeId = new mongoose.Types.ObjectId(userId);
    const projectDocs = await ProjectModel.find({
      status: 'under_development',
      assignedEmployees: assigneeId,
    })
      .select('_id')
      .lean();
    for (const p of projectDocs) {
      await this.syncStaffAssignmentsForProject((p._id as mongoose.Types.ObjectId).toString());
    }
  }

  private static escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Resolve proposal Mongo id from project customer + title (customer.inquiryId → proposals). */
  private static async resolveProposalIdForProject(clientId: string, projectName: string): Promise<string | null> {
    if (!clientId?.trim() || !projectName?.trim()) return null;
    const customer = await CustomerModel.findById(clientId.trim()).select('inquiryId').lean();
    const inqId = customer?.inquiryId;
    if (!inqId) return null;
    const name = projectName.trim();
    const exact = await ProposalModel.findOne({
      inquiryId: inqId,
      projectName: new RegExp(`^${ProjectService.escapeRegex(name)}$`, 'i'),
    })
      .sort({ createdAt: -1 })
      .select('_id')
      .lean();
    if (exact?._id) return exact._id.toString();
    const latest = await ProposalModel.findOne({ inquiryId: inqId })
      .sort({ createdAt: -1 })
      .select('_id')
      .lean();
    return latest?._id ? latest._id.toString() : null;
  }

  async listPendingPayoutApprovals(): Promise<PendingPayoutApprovalRow[]> {
    const docs = await ProjectModel.find({ status: 'under_development' })
      .select('projectName assignedEmployees assignedEmployeePayouts assignedEmployeePayoutRelease')
      .lean();

    const rows: PendingPayoutApprovalRow[] = [];
    const userIds = new Set<string>();

    for (const doc of docs) {
      const assignees = (doc.assignedEmployees || []).map((id) => id.toString());
      for (const devId of assignees) {
        if (ProjectService.payoutReleaseForUser(doc.assignedEmployeePayoutRelease, devId) !== 'submitted') continue;
        const amount = ProjectService.payoutAmountForUser(doc.assignedEmployeePayouts, devId);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        userIds.add(devId);
        rows.push({
          projectId: (doc._id as mongoose.Types.ObjectId).toString(),
          projectName: doc.projectName as string,
          developerId: devId,
          developerName: '',
          amount,
        });
      }
    }

    if (userIds.size === 0) return rows;
    const users = await UserModel.find({ _id: { $in: [...userIds] } })
      .select('name email')
      .lean();
    const byId = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    for (const r of rows) {
      const u = byId[r.developerId];
      if (u) {
        r.developerName = (u.name as string) || 'Developer';
        r.developerEmail = u.email as string | undefined;
      } else {
        r.developerName = 'Developer';
      }
    }

    return rows;
  }

  async submitDeveloperPayoutCompletion(projectId: string, developerUserId: string): Promise<Project | null> {
    await ensureWalletLedgerWalletStatusMigrated();
    const doc = await ProjectModel.findById(projectId);
    if (!doc || !isProjectInDevelopment(String(doc.status))) return null;
    const assignees = (doc.assignedEmployees || []).map((id) => id.toString());
    if (!assignees.includes(developerUserId)) return null;
    const amount = ProjectService.payoutAmountForUser(doc.assignedEmployeePayouts, developerUserId);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const cur = ProjectService.payoutReleaseForUser(doc.assignedEmployeePayoutRelease, developerUserId);
    if (cur === 'released') return null;
    if (cur === 'submitted') {
      const populated = await ProjectModel.findById(projectId).populate('clientId', 'name customerId');
      return populated ? this.toProject(populated) : null;
    }

    if (!doc.assignedEmployeePayoutRelease) doc.assignedEmployeePayoutRelease = new Map();
    doc.assignedEmployeePayoutRelease.set(developerUserId, 'submitted');
    doc.markModified('assignedEmployeePayoutRelease');
    await doc.save();

    const devOid = new mongoose.Types.ObjectId(developerUserId);
    await DeveloperWalletLedgerModel.findOneAndUpdate(
      { developerId: devOid, projectId: doc._id },
      {
        $set: {
          projectName: doc.projectName,
          amount,
          walletStatus: 'Pending' as const,
          submittedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await this.notifyOwnersPayoutReview(doc.projectName, developerUserId);

    await this.syncStaffAssignmentsForProject(projectId);

    const populated = await ProjectModel.findById(doc._id).populate('clientId', 'name customerId');
    return populated ? this.toProject(populated) : null;
  }

  private async notifyOwnersPayoutReview(projectName: string, developerUserId: string): Promise<void> {
    const dev = await UserModel.findById(developerUserId).select('name').lean();
    const devName = (dev?.name as string)?.trim() || 'A developer';
    const owners = await UserModel.find({ role: 'owner' }).select('_id').lean();
    const now = new Date();
    const messageBody = `Review Request: ${devName} marked "${projectName}" as completed. Approve in Developer payout approvals to set Wallet status from Pending to Available.`;
    for (const o of owners) {
      try {
        await this.paymentNotificationService.create({
          userId: o._id.toString(),
          type: 'system',
          triggerType: 'payout_review',
          scheduledAt: now,
          status: 'sent',
          sentAt: now,
          messageBody,
        });
      } catch {
        /* non-fatal */
      }
    }
  }

  async approveDeveloperPayoutRelease(
    projectId: string,
    developerUserId: string,
    approvedByUserId?: string
  ): Promise<Project | null> {
    await ensureWalletLedgerWalletStatusMigrated();
    const session = await mongoose.startSession();
    session.startTransaction();
    let payoutLogContext: {
      amount: number;
      projectName: string;
      pid: string;
      devId: string;
    } | null = null;
    try {
      const doc = await ProjectModel.findById(projectId).session(session);
      if (!doc || !isProjectInDevelopment(String(doc.status))) {
        await session.abortTransaction();
        return null;
      }
      const assignees = (doc.assignedEmployees || []).map((id) => id.toString());
      if (!assignees.includes(developerUserId)) {
        await session.abortTransaction();
        return null;
      }
      const cur = ProjectService.payoutReleaseForUser(doc.assignedEmployeePayoutRelease, developerUserId);
      if (cur !== 'submitted') {
        await session.abortTransaction();
        return null;
      }
      const amount = ProjectService.payoutAmountForUser(doc.assignedEmployeePayouts, developerUserId);
      if (!Number.isFinite(amount) || amount <= 0) {
        await session.abortTransaction();
        return null;
      }

      await UserModel.findByIdAndUpdate(
        developerUserId,
        { $inc: { walletBalance: amount } },
        { session, new: true }
      );

      const devOid = new mongoose.Types.ObjectId(developerUserId);
      await DeveloperWalletLedgerModel.findOneAndUpdate(
        { developerId: devOid, projectId: doc._id, walletStatus: 'Pending' },
        { $set: { walletStatus: 'Available' as const, approvedAt: new Date() } },
        { session }
      );

      if (!doc.assignedEmployeePayoutRelease) doc.assignedEmployeePayoutRelease = new Map();
      doc.assignedEmployeePayoutRelease.set(developerUserId, 'released');
      doc.markModified('assignedEmployeePayoutRelease');
      await doc.save({ session });

      await session.commitTransaction();
      payoutLogContext = {
        amount,
        projectName: doc.projectName as string,
        pid: (doc._id as mongoose.Types.ObjectId).toString(),
        devId: developerUserId,
      };
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    if (payoutLogContext && approvedByUserId?.trim()) {
      try {
        await this.expenseService.logAutomatedStaffSalaryFromPayoutApproval({
          amount: payoutLogContext.amount,
          developerId: payoutLogContext.devId,
          projectId: payoutLogContext.pid,
          projectName: payoutLogContext.projectName,
          recordedByUserId: approvedByUserId.trim(),
        });
      } catch {
        /* non-fatal: payout already applied */
      }
    }

    await this.syncStaffAssignmentsForProject(projectId);

    const populated = await ProjectModel.findById(projectId).populate('clientId', 'name customerId');
    return populated ? this.toProject(populated) : null;
  }

  private static releaseLeanToRecord(release: unknown): Record<string, PayoutReleaseStatus> {
    const out: Record<string, PayoutReleaseStatus> = {};
    if (release == null) return out;
    if (release instanceof Map) {
      release.forEach((v, k) => {
        const s = String(v);
        if (s === 'submitted' || s === 'released' || s === 'accruing') out[String(k)] = s;
      });
      return out;
    }
    if (typeof release === 'object') {
      for (const [k, v] of Object.entries(release as Record<string, unknown>)) {
        const s = String(v);
        if (s === 'submitted' || s === 'released' || s === 'accruing') out[k] = s;
      }
    }
    return out;
  }

  private static payoutReleaseForUser(release: unknown, userId: string): PayoutReleaseStatus {
    let raw: string | undefined;
    if (release == null) return 'accruing';
    if (release instanceof Map) {
      raw = (release.get(userId) ?? release.get(String(userId))) as string | undefined;
    } else if (typeof release === 'object') {
      raw = (release as Record<string, string>)[userId] ?? (release as Record<string, string>)[String(userId)];
    }
    if (raw === 'submitted' || raw === 'released' || raw === 'accruing') return raw;
    return 'accruing';
  }

  /** Serialize Mongoose Map or plain object to id → amount (Object.entries(Map) is always []). */
  private static payoutsMapToRecord(payouts: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (payouts == null) return out;
    if (payouts instanceof Map) {
      payouts.forEach((v, k) => {
        const n = Number(v);
        if (Number.isFinite(n)) out[String(k)] = n;
      });
      return out;
    }
    if (typeof payouts === 'object') {
      for (const [k, v] of Object.entries(payouts as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n)) out[k] = n;
      }
    }
    return out;
  }

  private static sumDeveloperPayouts(payouts: unknown): number {
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
      return Object.values(payouts as Record<string, unknown>).reduce<number>((sum, v) => {
        const n = Number(v);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
    }
    return 0;
  }

  private static payoutAmountForUser(payouts: unknown, userId: string): number {
    if (payouts == null) return 0;
    if (payouts instanceof Map) {
      const v = payouts.get(userId) ?? payouts.get(String(userId));
      return Number(v) || 0;
    }
    if (typeof payouts === 'object') {
      const o = payouts as Record<string, unknown>;
      const raw = o[userId] ?? o[String(userId)];
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  async update(id: string, data: UpdateProjectInput): Promise<Project | null> {
    const existingDoc = await ProjectModel.findById(id)
      .select('assignedEmployees projectName status assignedEmployeePayouts assignedEmployeePayoutRelease')
      .lean();
    if (!existingDoc) return null;

    const prevAssigneeIds = (existingDoc.assignedEmployees ?? []).map((oid) => oid.toString());

    const update: Record<string, unknown> = {};
    if (data.projectName !== undefined) update.projectName = data.projectName.trim();
    if (data.description !== undefined) update.description = data.description?.trim() || undefined;
    if (data.systemType !== undefined) update.systemType = data.systemType?.trim() || undefined;
    if (data.totalValue !== undefined) update.totalValue = Number(data.totalValue);
    if (data.expenses !== undefined) update.expenses = Math.max(0, Number(data.expenses));
    if (data.startDate !== undefined) update.startDate = data.startDate ? new Date(data.startDate) : undefined;
    if (data.endDate !== undefined) update.endDate = data.endDate ? new Date(data.endDate) : undefined;
    if (data.status !== undefined) update.status = normalizeProjectStatus(String(data.status));

    let addedUserIds: string[] = [];
    if (data.assignedEmployees !== undefined) {
      update.assignedEmployees = data.assignedEmployees.map((eid) => new mongoose.Types.ObjectId(eid));
      const newIds = data.assignedEmployees.map(String);
      addedUserIds = newIds.filter((eid) => !prevAssigneeIds.includes(eid));

      const resolvedStatus = normalizeProjectStatus(
        data.status !== undefined ? String(data.status) : String(existingDoc.status)
      );
      if (resolvedStatus === 'under_development' && addedUserIds.length > 0) {
        const providedPayouts = data.assignedEmployeePayouts ?? {};
        const missing = addedUserIds.filter((uid) => {
          const amount = Number(providedPayouts[uid]);
          return !Number.isFinite(amount) || amount <= 0;
        });
        if (missing.length > 0) {
          throw new Error(
            'Payout value is required for each newly assigned developer on under-development projects.'
          );
        }
      }
    }

    if (data.assignedEmployeePayouts !== undefined || data.assignedEmployees !== undefined) {
      const base = (existingDoc.assignedEmployeePayouts as Record<string, unknown> | undefined) || {};
      const baseRelease = ProjectService.releaseLeanToRecord(
        (existingDoc as { assignedEmployeePayoutRelease?: unknown }).assignedEmployeePayoutRelease
      );
      const provided = data.assignedEmployeePayouts || {};
      const selected = new Set((data.assignedEmployees || prevAssigneeIds).map(String));
      const nextPayouts: Record<string, number> = {};

      for (const uid of selected) {
        const raw = provided[uid] ?? base[uid];
        const amount = Number(raw);
        if (Number.isFinite(amount) && amount > 0) {
          nextPayouts[uid] = amount;
        }
      }

      const nextRelease: Record<string, PayoutReleaseStatus> = {};
      for (const uid of selected) {
        const newAmt = nextPayouts[uid];
        if (!Number.isFinite(newAmt) || newAmt <= 0) continue;
        const oldAmt = Number(base[uid]);
        const prev = baseRelease[uid];
        if (prev === 'released') {
          nextRelease[uid] = 'released';
        } else if (oldAmt !== newAmt) {
          nextRelease[uid] = 'accruing';
        } else if (prev === 'submitted') {
          nextRelease[uid] = 'submitted';
        } else {
          nextRelease[uid] = 'accruing';
        }
      }
      update.assignedEmployeePayouts = nextPayouts;
      update.assignedEmployeePayoutRelease = nextRelease;
    }

    const doc = await ProjectModel.findByIdAndUpdate(id, update, { new: true }).populate('clientId', 'name customerId');
    if (!doc) return null;

    if (addedUserIds.length > 0) {
      await this.notifyNewAssignees(addedUserIds, doc.projectName, doc);
    }

    await this.syncStaffAssignmentsForProject(id);

    return this.toProject(doc);
  }

  async delete(id: string): Promise<boolean> {
    await StaffAssignmentModel.deleteMany({ projectId: new mongoose.Types.ObjectId(id) });
    const result = await ProjectModel.findByIdAndDelete(id);
    return !!result;
  }

  private async notifyNewAssignees(
    userIds: string[],
    projectName: string,
    projectDoc: { assignedEmployeePayouts?: unknown }
  ): Promise<void> {
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select('email phone')
      .lean();
    const now = new Date();

    for (const u of users) {
      const uid = u._id.toString();
      const amount = ProjectService.payoutAmountForUser(projectDoc.assignedEmployeePayouts, uid);
      const inAppBody = assignmentInAppMessage(projectName, amount);
      const smsBody = ASSIGNMENT_SMS(projectName, amount);

      try {
        await this.paymentNotificationService.create({
          userId: uid,
          type: 'system',
          triggerType: 'assignment',
          scheduledAt: now,
          status: 'sent',
          sentAt: now,
          messageBody: inAppBody,
        });
      } catch {
        /* non-fatal */
      }

      const email = (u.email || '').trim();
      const phone = (u.phone || '').trim();
      if (phone) {
        try {
          await this.paymentNotificationService.create({
            userId: uid,
            type: 'sms',
            triggerType: 'assignment',
            scheduledAt: now,
            messageBody: smsBody,
          });
        } catch {
          /* non-fatal */
        }
      }
      if (email) {
        try {
          await this.paymentNotificationService.create({
            userId: uid,
            type: 'email',
            triggerType: 'assignment',
            scheduledAt: now,
            messageBody: inAppBody,
          });
        } catch {
          /* non-fatal */
        }
      }
    }
  }

  private toProject(doc: { toObject: () => Record<string, unknown> }): Project {
    const o = doc.toObject();
    const clientIdObj = o.clientId as { _id?: unknown; name?: string; customerId?: string } | null;
    const expensesRaw = o.expenses;
    const expenses = Number.isFinite(Number(expensesRaw)) ? Math.max(0, Number(expensesRaw)) : 0;

    const project: Project = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      clientId:
        clientIdObj && typeof clientIdObj === 'object' && clientIdObj._id
          ? (clientIdObj._id as { toString: () => string }).toString()
          : (o.clientId as string),
      projectName: o.projectName as string,
      description: o.description as string | undefined,
      systemType: o.systemType as string | undefined,
      totalValue: Number(o.totalValue),
      expenses,
      startDate: o.startDate as Date | undefined,
      endDate: o.endDate as Date | undefined,
      status: normalizeProjectStatus(String(o.status)),
      requirementWorkflowLabel:
        (o.requirementWorkflowLabel as Project['requirementWorkflowLabel']) ?? 'none',
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
    if (Array.isArray(o.assignedEmployees)) {
      project.assignedEmployees = (
        o.assignedEmployees as Array<{ _id?: { toString: () => string } } | mongoose.Types.ObjectId | string>
      ).map((entry) => {
        if (entry && typeof entry === 'object' && '_id' in entry && entry._id) {
          return entry._id.toString();
        }
        if (entry && typeof entry === 'object' && 'toString' in entry) {
          return (entry as { toString: () => string }).toString();
        }
        return String(entry);
      });
    }
    if (o.assignedEmployeePayouts != null && typeof o.assignedEmployeePayouts === 'object') {
      const pr = ProjectService.payoutsMapToRecord(o.assignedEmployeePayouts);
      if (Object.keys(pr).length > 0) project.assignedEmployeePayouts = pr;
    }
    if (o.assignedEmployeePayoutRelease && typeof o.assignedEmployeePayoutRelease === 'object') {
      const rel = ProjectService.releaseLeanToRecord(o.assignedEmployeePayoutRelease);
      if (Object.keys(rel).length > 0) project.assignedEmployeePayoutRelease = rel;
    }
    if (clientIdObj && typeof clientIdObj === 'object' && clientIdObj.name) {
      (project as Project & { clientName?: string }).clientName = clientIdObj.name;
    }

    const totalDeveloperPayouts = ProjectService.sumDeveloperPayouts(o.assignedEmployeePayouts);
    const totalValueNum = Number(project.totalValue);
    project.totalDeveloperPayouts = totalDeveloperPayouts;
    project.netProfit =
      (Number.isFinite(totalValueNum) ? totalValueNum : 0) - totalDeveloperPayouts - expenses;

    return project;
  }
}
