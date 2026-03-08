import { PaymentNotification } from '../../domain/entities/PaymentNotification';
import { PaymentNotificationModel } from '../../infrastructure/database/models/PaymentNotificationModel';

export interface CreatePaymentNotificationInput {
  clientId: string;
  installmentId?: string;
  type: 'sms' | 'email' | 'system';
  triggerType: 'due_reminder' | 'overdue' | 'receipt';
  scheduledAt: string | Date;
  messageBody?: string;
}

export interface ListPaymentNotificationsFilters {
  clientId?: string;
  status?: string;
  triggerType?: string;
}

export class PaymentNotificationService {
  async create(data: CreatePaymentNotificationInput): Promise<PaymentNotification> {
    const doc = await PaymentNotificationModel.create({
      clientId: data.clientId,
      installmentId: data.installmentId,
      type: data.type,
      triggerType: data.triggerType,
      scheduledAt: data.scheduledAt instanceof Date ? data.scheduledAt : new Date(data.scheduledAt),
      status: 'pending',
      messageBody: data.messageBody,
    });
    return this.toNotification(doc);
  }

  async findById(id: string): Promise<PaymentNotification | null> {
    const doc = await PaymentNotificationModel.findById(id)
      .populate('clientId', 'name companyName email')
      .populate('installmentId', 'installmentNo dueDate dueAmount paidAmount status');
    return doc ? this.toNotification(doc) : null;
  }

  async findByClientId(clientId: string): Promise<PaymentNotification[]> {
    const docs = await PaymentNotificationModel.find({ clientId })
      .populate('installmentId', 'installmentNo dueDate dueAmount status')
      .sort({ scheduledAt: -1 });
    return docs.map((d) => this.toNotification(d));
  }

  async findPending(limit = 100): Promise<PaymentNotification[]> {
    const docs = await PaymentNotificationModel.find({ status: 'pending' })
      .populate('clientId', 'name companyName email')
      .populate('installmentId', 'installmentNo dueDate dueAmount status planId')
      .sort({ scheduledAt: 1 })
      .limit(limit)
      .lean();
    return docs.map((d) => this.toNotification(d as { toObject: () => Record<string, unknown> }));
  }

  async markSent(id: string): Promise<PaymentNotification | null> {
    const doc = await PaymentNotificationModel.findByIdAndUpdate(
      id,
      { status: 'sent', sentAt: new Date() },
      { new: true }
    )
      .populate('clientId', 'name companyName email')
      .populate('installmentId', 'installmentNo dueDate dueAmount status');
    return doc ? this.toNotification(doc) : null;
  }

  async markFailed(id: string): Promise<PaymentNotification | null> {
    const doc = await PaymentNotificationModel.findByIdAndUpdate(id, { status: 'failed' }, { new: true });
    return doc ? this.toNotification(doc) : null;
  }

  async findAll(filters?: ListPaymentNotificationsFilters): Promise<PaymentNotification[]> {
    const query: Record<string, unknown> = {};
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.status) query.status = filters.status;
    if (filters?.triggerType) query.triggerType = filters.triggerType;
    const docs = await PaymentNotificationModel.find(query)
      .populate('clientId', 'name companyName email')
      .populate({
        path: 'installmentId',
        select: 'installmentNo dueDate dueAmount status planId',
        populate: { path: 'planId', select: 'projectId', populate: { path: 'projectId', select: 'projectName' } },
      })
      .sort({ scheduledAt: -1 });
    return docs.map((d) => this.toNotification(d));
  }

  private toNotification(doc: { toObject?: () => Record<string, unknown> }): PaymentNotification {
    const o = typeof doc.toObject === 'function' ? doc.toObject() : (doc as Record<string, unknown>);
    const client = o.clientId as { _id?: unknown } | null;
    const inst = o.installmentId as { _id?: unknown; planId?: { projectId?: { projectName?: string } } } | null;
    const notif: PaymentNotification & { clientName?: string; projectName?: string; installmentNo?: number } = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      clientId: client && typeof client === 'object' && client._id
        ? (client._id as { toString: () => string }).toString()
        : (o.clientId as string),
      type: o.type as 'sms' | 'email' | 'system',
      triggerType: o.triggerType as 'due_reminder' | 'overdue' | 'receipt',
      scheduledAt: o.scheduledAt as Date,
      status: o.status as 'pending' | 'sent' | 'failed',
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
    if (o.installmentId && inst && typeof inst === 'object' && inst._id) {
      notif.installmentId = (inst._id as { toString: () => string }).toString();
      if (typeof (inst as { installmentNo?: number }).installmentNo === 'number') {
        notif.installmentNo = (inst as { installmentNo: number }).installmentNo;
      }
      const plan = inst.planId;
      if (plan && typeof plan === 'object' && plan.projectId && typeof plan.projectId === 'object') {
        notif.projectName = (plan.projectId as { projectName?: string }).projectName;
      }
    }
    if (o.sentAt) notif.sentAt = o.sentAt as Date;
    if (o.messageBody) notif.messageBody = o.messageBody as string;
    if (client && typeof client === 'object' && 'companyName' in client) {
      notif.clientName = (client as { companyName?: string }).companyName || (client as { name?: string }).name as string;
    } else if (client && typeof client === 'object' && 'name' in client) {
      notif.clientName = (client as { name?: string }).name as string;
    }
    return notif;
  }
}
