import { PaymentPlan } from '../../domain/entities/PaymentPlan';
import { PaymentPlanModel } from '../../infrastructure/database/models/PaymentPlanModel';

export interface CreatePaymentPlanInput {
  projectId: string;
  downPaymentPct: number;
  downPaymentAmt: number;
  totalInstallments: number;
  installmentAmt: number;
  remainingBalance: number;
  planStartDate?: string;
  status?: 'active' | 'completed' | 'defaulted';
}

export interface UpdatePaymentPlanInput {
  downPaymentPct?: number;
  downPaymentAmt?: number;
  totalInstallments?: number;
  installmentAmt?: number;
  remainingBalance?: number;
  planStartDate?: string;
  status?: 'active' | 'completed' | 'defaulted';
}

export interface ListPaymentPlansFilters {
  projectId?: string;
  status?: string;
}

export class PaymentPlanService {
  async create(data: CreatePaymentPlanInput): Promise<PaymentPlan> {
    const doc = await PaymentPlanModel.create({
      projectId: data.projectId,
      downPaymentPct: Number(data.downPaymentPct),
      downPaymentAmt: Number(data.downPaymentAmt),
      totalInstallments: Number(data.totalInstallments),
      installmentAmt: Number(data.installmentAmt),
      remainingBalance: Number(data.remainingBalance),
      planStartDate: data.planStartDate ? new Date(data.planStartDate) : undefined,
      status: data.status || 'active',
    });
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
    if (filters?.projectId) query.projectId = filters.projectId;
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
      downPaymentPct: Number(o.downPaymentPct),
      downPaymentAmt: Number(o.downPaymentAmt),
      totalInstallments: Number(o.totalInstallments),
      installmentAmt: Number(o.installmentAmt),
      remainingBalance: Number(o.remainingBalance),
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
