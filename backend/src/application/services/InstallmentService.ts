import { Installment } from '../../domain/entities/Installment';
import { InstallmentModel } from '../../infrastructure/database/models/InstallmentModel';
import { PaymentPlanModel } from '../../infrastructure/database/models/PaymentPlanModel';

export interface CreateInstallmentInput {
  planId: string;
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
  paidAmount?: number;
  paidDate?: string;
  status?: 'pending' | 'paid' | 'partial' | 'overdue';
}

export interface ListInstallmentsFilters {
  planId?: string;
  status?: string;
}

export class InstallmentService {
  async create(data: CreateInstallmentInput): Promise<Installment> {
    const doc = await InstallmentModel.create({
      planId: data.planId,
      installmentNo: Number(data.installmentNo),
      dueDate: new Date(data.dueDate),
      dueAmount: Number(data.dueAmount),
      paidAmount: data.paidAmount !== undefined ? Number(data.paidAmount) : 0,
      paidDate: data.paidDate ? new Date(data.paidDate) : undefined,
      status: data.status || 'pending',
    });
    return this.toInstallment(doc);
  }

  /** Generate installments for a payment plan (e.g. monthly from planStartDate). */
  async createManyForPlan(planId: string): Promise<Installment[]> {
    const plan = await PaymentPlanModel.findById(planId);
    if (!plan) throw new Error('Payment plan not found');
    const existing = await InstallmentModel.countDocuments({ planId });
    if (existing > 0) throw new Error('Installments already exist for this plan');
    const startDate = plan.planStartDate ? new Date(plan.planStartDate) : new Date();
    const installmentAmt = Number(plan.installmentAmt);
    const total = Number(plan.totalInstallments);
    const created: Installment[] = [];
    for (let i = 1; i <= total; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      const doc = await InstallmentModel.create({
        planId,
        installmentNo: i,
        dueDate,
        dueAmount: installmentAmt,
        paidAmount: 0,
        status: 'pending',
        overdueDays: 0,
      });
      created.push(this.toInstallment(doc));
    }
    return created;
  }

  async findById(id: string): Promise<Installment | null> {
    const doc = await InstallmentModel.findById(id).populate({
      path: 'planId',
      select: 'projectId installmentAmt totalInstallments',
      populate: { path: 'projectId', select: 'projectName' },
    });
    return doc ? this.toInstallment(doc) : null;
  }

  async findByPlanId(planId: string): Promise<Installment[]> {
    const docs = await InstallmentModel.find({ planId })
      .populate({
        path: 'planId',
        select: 'projectId installmentAmt totalInstallments',
        populate: { path: 'projectId', select: 'projectName' },
      })
      .sort({ installmentNo: 1 });
    return docs.map((d) => this.toInstallment(d));
  }

  async findAll(filters?: ListInstallmentsFilters): Promise<Installment[]> {
    const query: Record<string, unknown> = {};
    if (filters?.planId) query.planId = filters.planId;
    if (filters?.status) query.status = filters.status;
    const docs = await InstallmentModel.find(query)
      .populate({
        path: 'planId',
        select: 'projectId installmentAmt totalInstallments',
        populate: { path: 'projectId', select: 'projectName' },
      })
      .sort({ dueDate: 1 });
    return docs.map((d) => this.toInstallment(d));
  }

  async update(id: string, data: Partial<CreateInstallmentInput>): Promise<Installment | null> {
    const update: Record<string, unknown> = { ...data };
    if (data.dueDate !== undefined) update.dueDate = new Date(data.dueDate);
    if (data.paidAmount !== undefined) update.paidAmount = Number(data.paidAmount);
    if (data.paidDate !== undefined) update.paidDate = data.paidDate ? new Date(data.paidDate) : undefined;
    const doc = await InstallmentModel.findByIdAndUpdate(id, update, { new: true }).populate({
      path: 'planId',
      select: 'projectId installmentAmt totalInstallments',
      populate: { path: 'projectId', select: 'projectName' },
    });
    return doc ? this.toInstallment(doc) : null;
  }

  async updatePaidAmount(installmentId: string, amount: number): Promise<Installment | null> {
    const inst = await InstallmentModel.findById(installmentId);
    if (!inst) return null;
    const newPaid = (Number(inst.paidAmount) || 0) + amount;
    const dueAmount = Number(inst.dueAmount);
    let status: 'pending' | 'paid' | 'partial' | 'overdue' = inst.status as 'pending' | 'paid' | 'partial' | 'overdue';
    if (newPaid >= dueAmount) {
      status = 'paid';
    } else if (newPaid > 0) {
      status = 'partial';
    }
    const doc = await InstallmentModel.findByIdAndUpdate(
      installmentId,
      {
        paidAmount: newPaid,
        paidDate: status === 'paid' ? new Date() : inst.paidDate,
        status,
      },
      { new: true }
    ).populate({
      path: 'planId',
      select: 'projectId installmentAmt totalInstallments',
      populate: { path: 'projectId', select: 'projectName' },
    });
    return doc ? this.toInstallment(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await InstallmentModel.findByIdAndDelete(id);
    return !!result;
  }

  private toInstallment(doc: { toObject: () => Record<string, unknown> }): Installment {
    const o = doc.toObject();
    const planObj = o.planId as { _id?: unknown; projectId?: { projectName?: string } } | null;
    const installment: Installment = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      planId: planObj && typeof planObj === 'object' && planObj._id
        ? (planObj._id as { toString: () => string }).toString()
        : (o.planId as string),
      installmentNo: Number(o.installmentNo),
      dueDate: o.dueDate as Date,
      dueAmount: Number(o.dueAmount),
      paidAmount: Number(o.paidAmount) || 0,
      paidDate: o.paidDate as Date | undefined,
      partialPaid: o.partialPaid !== undefined ? Number(o.partialPaid) : undefined,
      status: o.status as 'pending' | 'paid' | 'partial' | 'overdue',
      overdueDays: Number(o.overdueDays) || 0,
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
    if (planObj && typeof planObj === 'object' && planObj.projectId && typeof planObj.projectId === 'object') {
      const proj = planObj.projectId as { projectName?: string };
      if (proj.projectName) (installment as Installment & { projectName?: string }).projectName = proj.projectName;
    }
    return installment;
  }
}
