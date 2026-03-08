import { PaymentTransaction } from '../../domain/entities/PaymentTransaction';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { InstallmentModel } from '../../infrastructure/database/models/InstallmentModel';
import { InstallmentService } from './InstallmentService';
import { PaymentPlanService } from './PaymentPlanService';
import { InvoiceService } from './InvoiceService';

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'online';

export interface CreatePaymentTransactionInput {
  installmentId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  paymentDate: string;
  recordedBy: string;
  gatewayId?: string;
}

export interface ListPaymentTransactionsFilters {
  installmentId?: string;
  clientId?: string;
}

const installmentService = new InstallmentService();
const paymentPlanService = new PaymentPlanService();
const invoiceService = new InvoiceService();

export class PaymentTransactionService {
  async create(data: CreatePaymentTransactionInput): Promise<PaymentTransaction> {
    const installmentDoc = await InstallmentModel.findById(data.installmentId).populate({
      path: 'planId',
      select: 'projectId',
      populate: { path: 'projectId', select: 'clientId' },
    });
    if (!installmentDoc) throw new Error('Installment not found');
    const planObj = installmentDoc.planId as { _id?: unknown; projectId?: { clientId?: unknown } } | null;
    const projectObj = planObj && typeof planObj === 'object' && planObj.projectId ? planObj.projectId : null;
    const clientId = projectObj && typeof projectObj === 'object' && projectObj.clientId
      ? (projectObj.clientId as { toString: () => string }).toString()
      : null;
    if (!clientId) throw new Error('Could not resolve client for this installment');
    const planId = planObj && typeof planObj === 'object' && planObj._id
      ? (planObj._id as { toString: () => string }).toString()
      : null;
    if (!planId) throw new Error('Could not resolve plan for this installment');

    const dueAmount = Number(installmentDoc.dueAmount);
    const paidAmount = Number(installmentDoc.paidAmount) || 0;
    const remaining = dueAmount - paidAmount;
    const amount = Number(data.amount);
    if (amount <= 0) throw new Error('Amount must be greater than zero');
    if (amount > remaining) throw new Error(`Amount cannot exceed remaining due (Rs. ${remaining.toLocaleString()})`);

    const doc = await PaymentTransactionModel.create({
      installmentId: data.installmentId,
      clientId,
      gatewayId: data.gatewayId || undefined,
      amount,
      paymentMethod: data.paymentMethod,
      referenceNo: data.referenceNo?.trim() || undefined,
      paymentDate: new Date(data.paymentDate),
      recordedBy: data.recordedBy,
    });

    await installmentService.updatePaidAmount(data.installmentId, amount);
    await paymentPlanService.updateRemainingBalance(planId, amount);

    const invoiceNumber = await invoiceService.getNextInvoiceNumber();
    await invoiceService.create({
      transactionId: (doc._id as { toString: () => string }).toString(),
      clientId,
      invoiceNumber,
      invoiceDate: new Date(data.paymentDate),
      totalAmount: amount,
      status: 'paid',
    });

    const created = await PaymentTransactionModel.findById(doc._id)
      .populate({
        path: 'installmentId',
        select: 'installmentNo dueDate dueAmount paidAmount status planId',
        populate: { path: 'planId', select: 'projectId', populate: { path: 'projectId', select: 'projectName' } },
      })
      .populate('clientId', 'name companyName email')
      .populate('recordedBy', 'name email');
    return created ? this.toPaymentTransaction(created) : this.toPaymentTransaction(doc);
  }

  async findById(id: string): Promise<PaymentTransaction | null> {
    const doc = await PaymentTransactionModel.findById(id)
      .populate('installmentId', 'installmentNo dueDate dueAmount paidAmount status')
      .populate({ path: 'installmentId', populate: { path: 'planId', populate: { path: 'projectId', select: 'projectName' } } })
      .populate('clientId', 'name companyName email')
      .populate('recordedBy', 'name email');
    return doc ? this.toPaymentTransaction(doc) : null;
  }

  async findByInstallmentId(installmentId: string): Promise<PaymentTransaction[]> {
    const docs = await PaymentTransactionModel.find({ installmentId })
      .populate('recordedBy', 'name email')
      .sort({ paymentDate: -1 });
    return docs.map((d) => this.toPaymentTransaction(d));
  }

  async findByClientId(clientId: string): Promise<PaymentTransaction[]> {
    const docs = await PaymentTransactionModel.find({ clientId })
      .populate('installmentId', 'installmentNo dueDate dueAmount paidAmount status')
      .populate('recordedBy', 'name email')
      .sort({ paymentDate: -1 });
    return docs.map((d) => this.toPaymentTransaction(d));
  }

  async findAll(filters?: ListPaymentTransactionsFilters): Promise<PaymentTransaction[]> {
    const query: Record<string, unknown> = {};
    if (filters?.installmentId) query.installmentId = filters.installmentId;
    if (filters?.clientId) query.clientId = filters.clientId;
    const docs = await PaymentTransactionModel.find(query)
      .populate({
        path: 'installmentId',
        select: 'installmentNo dueDate dueAmount paidAmount status planId',
        populate: { path: 'planId', select: 'projectId', populate: { path: 'projectId', select: 'projectName' } },
      })
      .populate('clientId', 'name companyName email')
      .populate('recordedBy', 'name email')
      .sort({ paymentDate: -1 });
    return docs.map((d) => this.toPaymentTransaction(d));
  }

  private toPaymentTransaction(doc: { toObject: () => Record<string, unknown> }): PaymentTransaction {
    const o = doc.toObject();
    const inst = o.installmentId as { _id?: unknown; toString?: () => string } | null;
    const client = o.clientId as { _id?: unknown; name?: string; companyName?: string } | null;
    const recorded = o.recordedBy as { _id?: unknown; name?: string; email?: string } | null;
    const tx: PaymentTransaction & {
      installmentNo?: number;
      projectName?: string;
      clientName?: string;
      recordedByName?: string;
    } = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      installmentId: inst && typeof inst === 'object' && inst._id
        ? (inst._id as { toString: () => string }).toString()
        : (o.installmentId as string),
      clientId: client && typeof client === 'object' && client._id
        ? (client._id as { toString: () => string }).toString()
        : (o.clientId as string),
      amount: Number(o.amount),
      paymentMethod: o.paymentMethod as PaymentTransaction['paymentMethod'],
      referenceNo: o.referenceNo as string | undefined,
      paymentDate: o.paymentDate as Date,
      recordedBy: recorded && typeof recorded === 'object' && recorded._id
        ? (recorded._id as { toString: () => string }).toString()
        : (o.recordedBy as string),
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
    if (o.gatewayId) tx.gatewayId = (o.gatewayId as { toString: () => string }).toString();
    const instObj = o.installmentId as { installmentNo?: number; planId?: { projectId?: { projectName?: string } } } | null;
    if (instObj && typeof instObj === 'object') {
      tx.installmentNo = instObj.installmentNo;
      const plan = instObj.planId;
      if (plan && typeof plan === 'object' && plan.projectId && typeof plan.projectId === 'object') {
        tx.projectName = (plan.projectId as { projectName?: string }).projectName;
      }
    }
    if (client && typeof client === 'object') {
      tx.clientName = (client.companyName as string) || (client.name as string) || undefined;
    }
    if (recorded && typeof recorded === 'object') {
      tx.recordedByName = (recorded.name as string) || (recorded.email as string) || undefined;
    }
    return tx;
  }
}
