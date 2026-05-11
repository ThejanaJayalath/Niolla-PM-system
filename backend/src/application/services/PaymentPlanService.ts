import mongoose from 'mongoose';
import { PaymentPlan } from '../../domain/entities/PaymentPlan';
import { PaymentPlanModel } from '../../infrastructure/database/models/PaymentPlanModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { CustomerRequirementModel } from '../../infrastructure/database/models/CustomerRequirementModel';
import { InstallmentService } from './InstallmentService';
import { PaymentNotificationService } from './PaymentNotificationService';

export interface CreatePaymentPlanInput {
  projectId: string;
  downPaymentPct: number;
  downPaymentAmt: number;
  totalInstallments: number;
  installmentAmt: number;
  remainingBalance: number;
  serviceFeePct: number;
  serviceFeeAmt: number;
  planStartDate?: string;
  status?: 'active' | 'completed' | 'defaulted';
}

export interface UpdatePaymentPlanInput {
  downPaymentPct?: number;
  downPaymentAmt?: number;
  totalInstallments?: number;
  installmentAmt?: number;
  remainingBalance?: number;
  serviceFeePct?: number;
  serviceFeeAmt?: number;
  planStartDate?: string;
  status?: 'active' | 'completed' | 'defaulted';
}

export interface ListPaymentPlansFilters {
  projectId?: string;
  /** Customer (Mongo) id — returns plans for all projects owned by this client. */
  clientId?: string;
  status?: string;
}

export class PaymentPlanService {
  /**
   * Add-on payment plan for a customer requirement: separate totals from the main project contract.
   */
  async createAddonPlanForRequirement(input: {
    projectId: string;
    requirementId: string;
    totalValue: number;
    downPaymentPct: number;
    totalInstallments: number;
    serviceFeePct?: number;
    planStartDate?: string;
  }): Promise<PaymentPlan> {
    const totalValue = Number(input.totalValue);
    const downPaymentPct = Number(input.downPaymentPct);
    const totalInstallments = Math.max(1, Math.floor(Number(input.totalInstallments)));
    const downPaymentAmt = (totalValue * downPaymentPct) / 100;
    const remainingAfterDown = totalValue - downPaymentAmt;
    const serviceFeePct = Number(input.serviceFeePct ?? 0);
    const serviceFeeAmt = (totalValue * serviceFeePct) / 100;
    const installmentAmt =
      totalInstallments > 0 ? (remainingAfterDown + serviceFeeAmt) / totalInstallments : 0;

    const doc = await PaymentPlanModel.create({
      projectId: new mongoose.Types.ObjectId(input.projectId),
      planKind: 'addon',
      linkedRequirementId: new mongoose.Types.ObjectId(input.requirementId),
      downPaymentPct,
      downPaymentAmt,
      totalInstallments,
      installmentAmt,
      remainingBalance: remainingAfterDown,
      serviceFeePct,
      serviceFeeAmt,
      planStartDate: input.planStartDate ? new Date(input.planStartDate) : new Date(),
      status: 'active',
    });
    const installmentService = new InstallmentService();
    const installments = await installmentService.createManyForPlan(String(doc._id));
    await this.notifyClientRequirementAddonPayment({
      projectId: input.projectId,
      requirementId: input.requirementId,
      projectName: undefined,
      totalValue,
      downPaymentPct,
      downPaymentAmt,
      totalInstallments,
      installmentAmt,
      firstInstallmentId: installments[0]?._id,
    });
    return this.toPaymentPlan(doc);
  }

  /**
   * Primary contract plan + installments from a confirmed proposal (mirrors template math; no template required).
   * Idempotent: if the project already has a primary plan, returns it and does not duplicate installments.
   */
  async createPrimaryPlanFromProposal(input: {
    projectId: string;
    totalAmount: number;
    advancePayment: number;
    installmentMonths: number;
    monthlyInstallment?: number;
  }): Promise<PaymentPlan | null> {
    const projectOid = new mongoose.Types.ObjectId(input.projectId);
    const existing = await PaymentPlanModel.findOne({ projectId: projectOid, planKind: 'primary' });
    if (existing) {
      return this.toPaymentPlan(existing);
    }

    const totalValue = Math.max(0, Number(input.totalAmount));
    const downPaymentAmt = Math.max(0, Number(input.advancePayment ?? 0));
    const downPaymentPct = totalValue > 0 ? (downPaymentAmt / totalValue) * 100 : 0;
    const remainingAfterDown = Math.max(0, totalValue - downPaymentAmt);
    const months = Math.max(0, Math.floor(Number(input.installmentMonths ?? 0)));
    let installmentAmt = 0;
    if (months > 0) {
      const m = input.monthlyInstallment;
      if (m !== undefined && m !== null && Number.isFinite(Number(m)) && Number(m) > 0) {
        installmentAmt = Number(m);
      } else {
        installmentAmt = months > 0 ? remainingAfterDown / months : 0;
      }
    }

    const doc = await PaymentPlanModel.create({
      projectId: projectOid,
      planKind: 'primary',
      downPaymentPct,
      downPaymentAmt,
      totalInstallments: months,
      installmentAmt,
      remainingBalance: remainingAfterDown,
      serviceFeePct: 0,
      serviceFeeAmt: 0,
      planStartDate: new Date(),
      status: 'active',
    });

    if (months > 0) {
      const installmentService = new InstallmentService();
      await installmentService.createManyForPlan(String(doc._id));
    }

    return this.toPaymentPlan(doc);
  }

  /**
   * Tell the linked customer that a new add-on (requirement) payment is due — separate from the main contract.
   * Non-fatal: plan creation succeeds even if notification fails.
   */
  private async notifyClientRequirementAddonPayment(args: {
    projectId: string;
    requirementId: string;
    projectName?: string;
    totalValue: number;
    downPaymentPct: number;
    downPaymentAmt: number;
    totalInstallments: number;
    installmentAmt: number;
    firstInstallmentId?: string;
  }): Promise<void> {
    try {
      const project = await ProjectModel.findById(args.projectId).select('projectName clientId').lean();
      const clientRaw = project?.clientId as { toString?: () => string } | string | undefined;
      const clientId =
        clientRaw && typeof (clientRaw as { toString?: () => string }).toString === 'function'
          ? (clientRaw as { toString: () => string }).toString()
          : typeof clientRaw === 'string'
            ? clientRaw
            : undefined;
      if (!clientId) return;

      const reqLean = await CustomerRequirementModel.findById(args.requirementId).select('title').lean();
      const featureTitle = (reqLean?.title as string | undefined)?.trim() || 'Additional feature';
      const projectLabel =
        args.projectName?.trim() ||
        (project?.projectName as string | undefined)?.trim() ||
        'Your project';

      const fmt = (n: number) =>
        Number.isFinite(n) ? n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

      const lines: string[] = [
        `New add-on feature on "${projectLabel}": ${featureTitle}.`,
        `This amount is separate from your original proposal / main project payment plan.`,
        `Add-on contract total: LKR ${fmt(args.totalValue)}.`,
      ];
      if (args.downPaymentAmt > 0) {
        lines.push(`Down payment (${args.downPaymentPct}%): LKR ${fmt(args.downPaymentAmt)}.`);
      }
      lines.push(
        `${args.totalInstallments} scheduled installment(s) of LKR ${fmt(args.installmentAmt)} each (covering balance after down payment, if any).`,
        `Please arrange payment as agreed. Staff will record each installment when paid (Installments).`
      );

      const notificationService = new PaymentNotificationService();
      const now = new Date();
      await notificationService.create({
        clientId,
        ...(args.firstInstallmentId ? { installmentId: args.firstInstallmentId } : {}),
        type: 'system',
        triggerType: 'requirement_addon',
        scheduledAt: now,
        status: 'sent',
        sentAt: now,
        messageBody: lines.join(' '),
      });
    } catch {
      /* non-fatal */
    }
  }

  async create(data: CreatePaymentPlanInput): Promise<PaymentPlan> {
    const doc = await PaymentPlanModel.create({
      projectId: data.projectId,
      downPaymentPct: Number(data.downPaymentPct),
      downPaymentAmt: Number(data.downPaymentAmt),
      totalInstallments: Number(data.totalInstallments),
      installmentAmt: Number(data.installmentAmt),
      remainingBalance: Number(data.remainingBalance),
      serviceFeePct: Number(data.serviceFeePct ?? 0),
      serviceFeeAmt: Number(data.serviceFeeAmt ?? 0),
      planStartDate: data.planStartDate ? new Date(data.planStartDate) : undefined,
      status: data.status || 'active',
    });
    return this.toPaymentPlan(doc);
  }

  async instantiate(data: { projectId: string; templateId: string; planStartDate?: string }): Promise<PaymentPlan> {
    const template = await mongoose.model('PaymentPlanTemplate').findById(data.templateId) as any;
    if (!template) throw new Error('Template not found');

    const project = await mongoose.model('Project').findById(data.projectId) as any;
    if (!project) throw new Error('Project not found');

    const totalValue = project.totalValue;

    const downPaymentAmt = (totalValue * template.downPaymentPct) / 100;
    const remainingAfterDown = totalValue - downPaymentAmt;
    const totalInstallments = template.installmentsCount;
    const serviceFeePct = Number(template.serviceFeePct ?? 0);
    const serviceFeeAmt = (totalValue * serviceFeePct) / 100;
    // Each installment = (remaining balance + service fee) split equally
    const installmentAmt = totalInstallments > 0
      ? (remainingAfterDown + serviceFeeAmt) / totalInstallments
      : 0;

    const doc = await PaymentPlanModel.create({
      projectId: data.projectId,
      planKind: 'primary',
      downPaymentPct: template.downPaymentPct,
      downPaymentAmt,
      totalInstallments,
      installmentAmt,
      remainingBalance: remainingAfterDown,
      serviceFeePct,
      serviceFeeAmt,
      planStartDate: data.planStartDate ? new Date(data.planStartDate) : new Date(),
      status: 'active',
    });

    const installmentService = new InstallmentService();
    await installmentService.createManyForPlan(String(doc._id));

    return this.toPaymentPlan(doc);
  }

  async findById(id: string): Promise<PaymentPlan | null> {
    const doc = await PaymentPlanModel.findById(id).populate('projectId', 'projectName totalValue clientId');
    return doc ? this.toPaymentPlan(doc) : null;
  }

  async findByProjectId(projectId: string): Promise<PaymentPlan[]> {
    const docs = await PaymentPlanModel.find({ projectId })
      .populate('projectId', 'projectName totalValue clientId')
      .sort({ createdAt: -1 });
    return docs.map((d) => this.toPaymentPlan(d));
  }

  async findAll(filters?: ListPaymentPlansFilters): Promise<PaymentPlan[]> {
    const query: Record<string, unknown> = {};
    if (filters?.projectId) {
      query.projectId = filters.projectId;
    } else if (filters?.clientId) {
      const projectDocs = await ProjectModel.find({ clientId: filters.clientId }).select('_id').lean();
      const projectIds = projectDocs.map((p) => p._id);
      if (projectIds.length === 0) {
        return [];
      }
      query.projectId = { $in: projectIds };
    }
    if (filters?.status) query.status = filters.status;
    const docs = await PaymentPlanModel.find(query)
      .populate('projectId', 'projectName totalValue clientId')
      .sort({ createdAt: -1 });
    return docs.map((d) => this.toPaymentPlan(d));
  }

  async update(id: string, data: UpdatePaymentPlanInput): Promise<PaymentPlan | null> {
    const update: Record<string, unknown> = { ...data };
    if (data.downPaymentPct !== undefined) update.downPaymentPct = Number(data.downPaymentPct);
    if (data.downPaymentAmt !== undefined) update.downPaymentAmt = Number(data.downPaymentAmt);
    if (data.totalInstallments !== undefined) update.totalInstallments = Number(data.totalInstallments);
    if (data.installmentAmt !== undefined) update.installmentAmt = Number(data.installmentAmt);
    if (data.remainingBalance !== undefined) update.remainingBalance = Number(data.remainingBalance);
    if (data.serviceFeePct !== undefined) update.serviceFeePct = Number(data.serviceFeePct);
    if (data.serviceFeeAmt !== undefined) update.serviceFeeAmt = Number(data.serviceFeeAmt);
    if (data.planStartDate !== undefined) update.planStartDate = data.planStartDate ? new Date(data.planStartDate) : undefined;
    const doc = await PaymentPlanModel.findByIdAndUpdate(id, update, { new: true }).populate(
      'projectId',
      'projectName totalValue clientId'
    );
    return doc ? this.toPaymentPlan(doc) : null;
  }

  async updateRemainingBalance(planId: string, amount: number): Promise<PaymentPlan | null> {
    const doc = await PaymentPlanModel.findByIdAndUpdate(
      planId,
      { $inc: { remainingBalance: -amount } },
      { new: true }
    ).populate('projectId', 'projectName totalValue clientId');
    return doc ? this.toPaymentPlan(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await PaymentPlanModel.findByIdAndDelete(id);
    return !!result;
  }

  private toPaymentPlan(doc: { toObject: () => Record<string, unknown> }): PaymentPlan {
    const o = doc.toObject();
    const projectObj = o.projectId as { _id?: unknown; projectName?: string; totalValue?: number } | null;
    const plan: PaymentPlan = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      projectId: projectObj && typeof projectObj === 'object' && projectObj._id
        ? (projectObj._id as { toString: () => string }).toString()
        : (o.projectId as string),
      planKind: (o.planKind as PaymentPlan['planKind']) || 'primary',
      linkedRequirementId: o.linkedRequirementId
        ? (o.linkedRequirementId as { toString: () => string }).toString()
        : undefined,
      downPaymentPct: Number(o.downPaymentPct),
      downPaymentAmt: Number(o.downPaymentAmt),
      totalInstallments: Number(o.totalInstallments),
      installmentAmt: Number(o.installmentAmt),
      remainingBalance: Number(o.remainingBalance),
      serviceFeePct: Number(o.serviceFeePct ?? 0),
      serviceFeeAmt: Number(o.serviceFeeAmt ?? 0),
      planStartDate: o.planStartDate as Date | undefined,
      status: o.status as 'active' | 'completed' | 'defaulted',
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
    if (projectObj && typeof projectObj === 'object' && projectObj.projectName) {
      (plan as PaymentPlan & { projectName?: string }).projectName = projectObj.projectName;
    }
    return plan;
  }
}
