import { Response } from 'express';
import { PaymentNotificationService } from '../../application/services/PaymentNotificationService';
import { AuthenticatedRequest } from '../middleware/auth';

const paymentNotificationService = new PaymentNotificationService();

export async function listPaymentNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientId = req.query.clientId as string | undefined;
  const status = req.query.status as string | undefined;
  const triggerType = req.query.triggerType as string | undefined;
  const notifications = await paymentNotificationService.findAll({ clientId, status, triggerType });
  res.json({ success: true, data: notifications });
}

export async function getPaymentNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
  const notification = await paymentNotificationService.findById(req.params.id);
  if (!notification) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    return;
  }
  res.json({ success: true, data: notification });
}

export async function markNotificationSent(req: AuthenticatedRequest, res: Response): Promise<void> {
  const notification = await paymentNotificationService.markSent(req.params.id);
  if (!notification) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    return;
  }
  res.json({ success: true, data: notification });
}

export async function createPaymentNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { clientId, installmentId, type, triggerType, scheduledAt, messageBody } = req.body;
    const notification = await paymentNotificationService.create({
      clientId,
      installmentId,
      type,
      triggerType,
      scheduledAt,
      messageBody,
    });
    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create notification';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}
