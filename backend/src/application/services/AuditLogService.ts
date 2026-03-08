import { AuditLog } from '../../domain/entities/AuditLog';
import { AuditLogModel } from '../../infrastructure/database/models/AuditLogModel';

export interface ListAuditLogsFilters {
  userId?: string;
  action?: string;
  tableName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class AuditLogService {
  async log(
    userId: string,
    action: string,
    tableName: string,
    recordId?: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<AuditLog> {
    const doc = await AuditLogModel.create({
      userId,
      action,
      tableName,
      recordId,
      oldValue,
      newValue,
      ipAddress,
    });
    return this.toAuditLog(doc);
  }

  async findById(id: string): Promise<AuditLog | null> {
    const doc = await AuditLogModel.findById(id).populate('userId', 'name email').lean();
    return doc ? this.toAuditLog(doc as { toObject?: () => Record<string, unknown> }) : null;
  }

  async findAll(filters?: ListAuditLogsFilters): Promise<AuditLog[]> {
    const query: Record<string, unknown> = {};
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.action) query.action = filters.action;
    if (filters?.tableName) query.tableName = filters.tableName;
    if (filters?.dateFrom || filters?.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) (query.createdAt as Record<string, Date>).$gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        (query.createdAt as Record<string, Date>).$lte = end;
      }
    }
    const docs = await AuditLogModel.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return docs.map((d) => this.toAuditLog(d as { toObject?: () => Record<string, unknown> }));
  }

  private toAuditLog(doc: { toObject?: () => Record<string, unknown> }): AuditLog {
    const o = typeof doc.toObject === 'function' ? doc.toObject() : (doc as Record<string, unknown>);
    const user = o.userId as { _id?: unknown; name?: string; email?: string } | null;
    const log: AuditLog & { userName?: string } = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      userId: user && typeof user === 'object' && user._id
        ? (user._id as { toString: () => string }).toString()
        : (o.userId as string),
      action: o.action as string,
      tableName: o.tableName as string,
      createdAt: o.createdAt as Date,
    };
    if (o.recordId) log.recordId = o.recordId as string;
    if (o.oldValue) log.oldValue = o.oldValue as Record<string, unknown>;
    if (o.newValue) log.newValue = o.newValue as Record<string, unknown>;
    if (o.ipAddress) log.ipAddress = o.ipAddress as string;
    if (user && typeof user === 'object') {
      (log as AuditLog & { userName?: string }).userName = (user.name as string) || (user.email as string);
    }
    return log;
  }
}
