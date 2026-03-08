import { Response } from 'express';
import { AuditLogService } from '../../application/services/AuditLogService';
import { AuthenticatedRequest } from '../middleware/auth';

const auditLogService = new AuditLogService();

export async function listAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.query.userId as string | undefined;
  const action = req.query.action as string | undefined;
  const tableName = req.query.tableName as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  const logs = await auditLogService.findAll({ userId, action, tableName, dateFrom, dateTo });
  res.json({ success: true, data: logs });
}

export async function getAuditLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  const log = await auditLogService.findById(req.params.id);
  if (!log) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Audit log entry not found' } });
    return;
  }
  res.json({ success: true, data: log });
}
