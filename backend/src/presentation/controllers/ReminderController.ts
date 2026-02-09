import { Response } from 'express';
import { ReminderService } from '../../application/services/ReminderService';
import { AuthenticatedRequest } from '../middleware/auth';

const reminderService = new ReminderService();

export async function createReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { inquiryId, customerName, type, title, description, meetingLink, scheduledAt, notes, status } = req.body;
  const reminder = await reminderService.create({
    inquiryId,
    customerName,
    type,
    title,
    description,
    meetingLink,
    scheduledAt: new Date(scheduledAt),
    notes,
    status,
  });
  res.status(201).json({ success: true, data: reminder });
}

export async function getReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const reminder = await reminderService.findById(req.params.id);
  if (!reminder) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }
  res.json({ success: true, data: reminder });
}

export async function getRemindersByInquiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const reminders = await reminderService.findByInquiryId(req.params.inquiryId);
  res.json({ success: true, data: reminders });
}

export async function getUpcomingReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
  const type = req.query.type as string | undefined;
  const reminders = await reminderService.findUpcoming(limit, type);
  res.json({ success: true, data: reminders });
}

export async function updateReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { scheduledAt, ...rest } = req.body;
  const update: any = { ...rest };
  if (scheduledAt) update.scheduledAt = new Date(scheduledAt);
  const reminder = await reminderService.update(req.params.id, update);
  if (!reminder) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }
  res.json({ success: true, data: reminder });
}

export async function deleteReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await reminderService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }
  res.status(204).send();
}
