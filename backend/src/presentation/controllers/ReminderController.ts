import { Response } from 'express';
import { ReminderService } from '../../application/services/ReminderService';
import {
  createGoogleMeetEvent,
  updateGoogleMeetEvent,
  deleteGoogleMeetEvent,
} from '../../application/services/GoogleCalendarService';
import { AuthenticatedRequest } from '../middleware/auth';

const reminderService = new ReminderService();

function handleGoogleCalendarError(err: unknown, res: Response): boolean {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const details =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: unknown } }).response?.data
      : undefined;
  console.error('[Reminder] Google Calendar error:', message, details ?? err);
  res.status(502).json({
    success: false,
    error: {
      code: 'GOOGLE_MEET_ERROR',
      message: 'Calendar operation failed. Check OAuth and env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).',
      detail: process.env.NODE_ENV !== 'production' ? String(message) : undefined,
      ...(process.env.NODE_ENV !== 'production' && details ? { googleResponse: details } : {}),
    },
  });
  return true;
}

export async function createReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    inquiryId,
    customerName,
    type,
    title,
    description,
    meetingLink,
    scheduledAt,
    notes,
    status,
    meetingDurationMinutes,
    attendees,
    sendInvites,
    recurrence,
  } = req.body;
  const scheduledDate = new Date(scheduledAt);

  let finalMeetingLink = meetingLink;
  let googleEventId: string | undefined;

  if (type === 'meeting') {
    try {
      const result = await createGoogleMeetEvent({
        title,
        description,
        startTime: scheduledDate,
        durationMinutes: meetingDurationMinutes ? Number(meetingDurationMinutes) : undefined,
        attendees: Array.isArray(attendees) ? attendees : undefined,
        sendInvites: !!sendInvites,
        recurrence: Array.isArray(recurrence) ? recurrence : undefined,
      });
      finalMeetingLink = result.meetLink;
      googleEventId = result.googleEventId;
    } catch (err: unknown) {
      if (handleGoogleCalendarError(err, res)) return;
      throw err;
    }
  }

  const reminder = await reminderService.create({
    inquiryId,
    customerName,
    type,
    title,
    description,
    meetingLink: finalMeetingLink,
    googleEventId,
    scheduledAt: scheduledDate,
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
  const id = req.params.id;
  const existing = await reminderService.findById(id);
  if (!existing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }

  const { scheduledAt, ...rest } = req.body;
  const update: Record<string, unknown> = { ...rest };
  if (scheduledAt) update.scheduledAt = new Date(scheduledAt);

  if (
    existing.type === 'meeting' &&
    existing.googleEventId &&
    scheduledAt &&
    new Date(scheduledAt).getTime() !== new Date(existing.scheduledAt).getTime()
  ) {
    try {
      const startTime = new Date(scheduledAt);
      await updateGoogleMeetEvent(existing.googleEventId, { startTime });
    } catch (err: unknown) {
      if (handleGoogleCalendarError(err, res)) return;
    }
  }

  const reminder = await reminderService.update(id, update as import('../../application/services/ReminderService').UpdateReminderInput);
  if (!reminder) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }
  res.json({ success: true, data: reminder });
}

export async function deleteReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = req.params.id;
  const existing = await reminderService.findById(id);
  if (!existing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }

  if (existing.type === 'meeting' && existing.googleEventId) {
    try {
      await deleteGoogleMeetEvent(existing.googleEventId, { notifyAttendees: true });
    } catch (err: unknown) {
      if (handleGoogleCalendarError(err, res)) return;
    }
  }

  const deleted = await reminderService.delete(id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }
  res.status(204).send();
}
