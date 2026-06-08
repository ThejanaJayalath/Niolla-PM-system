import { PaymentNotification } from '../../domain/entities/PaymentNotification';
import { PaymentNotificationModel } from '../../infrastructure/database/models/PaymentNotificationModel';

export interface CreatePaymentNotificationInput {
  clientId?: string;
  userId?: string;
  installmentId?: string;
  type: 'sms' | 'email' | 'system';
  triggerType:
    | 'due_reminder'
    | 'overdue'
    | 'receipt'
    | 'assignment'
    | 'payout_review'
    | 'status_notification'
    | 'requirement_addon'
    | 'birthday'
    | 'anniversary';
  scheduledAt: string | Date;
  messageBody?: string;
  status?: 'pending' | 'sent' | 'failed';
  sentAt?: string | Date;
}

export interface ListPaymentNotificationsFilters {
  clientId?: string;
  userId?: string;
  status?: string;
  triggerType?: string;
}

const userPopulate = 'name email phone';
const clientPopulate = 'name companyName email';

export class PaymentNotificationService {
  async create(data: CreatePaymentNotificationInput): Promise<PaymentNotification> {
    const hasClient = Boolean(data.clientId?.trim());
    const hasUser = Boolean(data.userId?.trim());
    if (!hasClient && !hasUser) {
      throw new Error('Either clientId or userId is required');
    }
    const doc = await PaymentNotificationModel.create({
      ...(hasClient ? { clientId: data.clientId!.trim() } : {}),
      ...(hasUser ? { userId: data.userId!.trim() } : {}),
      ...(data.installmentId ? { installmentId: data.installmentId } : {}),
      type: data.type,
      triggerType: data.triggerType,
      scheduledAt: data.scheduledAt instanceof Date ? data.scheduledAt : new Date(data.scheduledAt),
      status: data.status ?? 'pending',
      ...(data.sentAt
        ? { sentAt: data.sentAt instanceof Date ? data.sentAt : new Date(data.sentAt) }
        : {}),
      messageBody: data.messageBody,
    });
    return this.toNotification(doc);
  }

  async findById(id: string): Promise<PaymentNotification | null> {
    const doc = await PaymentNotificationModel.findById(id)
      .populate('clientId', clientPopulate)
      .populate('userId', userPopulate)
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
      .populate('clientId', clientPopulate)
      .populate('userId', userPopulate)
      .populate('installmentId', 'installmentNo dueDate dueAmount status planId')
      .sort({ scheduledAt: 1 })
      .limit(limit)
      .lean();
    return docs.map((d) => this.toNotification(d));
  }

  async markSent(id: string): Promise<PaymentNotification | null> {
    const doc = await PaymentNotificationModel.findByIdAndUpdate(
      id,
      { status: 'sent', sentAt: new Date() },
      { new: true }
    )
      .populate('clientId', clientPopulate)
      .populate('userId', userPopulate)
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
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.status) query.status = filters.status;
    if (filters?.triggerType) query.triggerType = filters.triggerType;
    const docs = await PaymentNotificationModel.find(query)
      .populate('clientId', clientPopulate)
      .populate('userId', userPopulate)
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
    const client = o.clientId as { _id?: unknown; name?: string; companyName?: string } | null;
    const user = o.userId as { _id?: unknown; name?: string; email?: string } | null;
    const inst = o.installmentId as { _id?: unknown; planId?: { projectId?: { projectName?: string } } } | null;

    let clientId: string | undefined;
    if (client && typeof client === 'object' && client._id) {
      clientId = (client._id as { toString: () => string }).toString();
    } else if (o.clientId) {
      const raw = o.clientId as { toString?: () => string };
      clientId = typeof raw?.toString === 'function' ? raw.toString() : String(o.clientId);
    }

    let userId: string | undefined;
    if (user && typeof user === 'object' && user._id) {
      userId = (user._id as { toString: () => string }).toString();
    } else if (o.userId) {
      const raw = o.userId as { toString?: () => string };
      userId = typeof raw?.toString === 'function' ? raw.toString() : String(o.userId);
    }

    const notif: PaymentNotification & {
      clientName?: string;
      userName?: string;
      projectName?: string;
      installmentNo?: number;
    } = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      ...(clientId !== undefined ? { clientId } : {}),
      ...(userId !== undefined ? { userId } : {}),
      type: o.type as 'sms' | 'email' | 'system',
      triggerType: o.triggerType as
        | 'due_reminder'
        | 'overdue'
        | 'receipt'
        | 'assignment'
        | 'payout_review'
        | 'status_notification'
        | 'requirement_addon',
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
      notif.clientName =
        (client as { companyName?: string }).companyName || ((client as { name?: string }).name as string);
    } else if (client && typeof client === 'object' && 'name' in client) {
      notif.clientName = (client as { name?: string }).name as string;
    }
    if (user && typeof user === 'object' && user.name) {
      notif.userName = user.name;
    }
    return notif;
  }
}
