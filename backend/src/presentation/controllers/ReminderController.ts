import { Response } from 'express';
import { ReminderService } from '../../application/services/ReminderService';
import {
  createGoogleMeetEvent,
  updateGoogleMeetEvent,
  deleteGoogleMeetEvent,
} from '../../application/services/GoogleCalendarService';
import { CustomerService } from '../../application/services/CustomerService';
import { InteractionService } from '../../application/services/InteractionService';
import { AuthenticatedRequest } from '../middleware/auth';

const reminderService = new ReminderService();
const customerService = new CustomerService();
const interactionService = new InteractionService();

async function mirrorReminderInteraction(
  reminder: {
    inquiryId?: string;
    type: 'reminder' | 'meeting';
    title: string;
    description?: string;
    notes?: string;
    scheduledAt: Date;
  },
  createdBy?: string
): Promise<void> {
  if (!reminder.inquiryId) return;
  const customer = await customerService.findByInquiryId(reminder.inquiryId);
  if (!customer?._id) return;
  await interactionService.create({
    customerRef: String(customer._id),
    inquiryRef: reminder.inquiryId,
    type: reminder.type === 'meeting' ? 'MEETING' : 'NOTE',
    summary: reminder.title,
    details: [reminder.description, reminder.notes].filter(Boolean).join(' | ') || undefined,
    occurredAt: new Date(reminder.scheduledAt),
    createdBy,
  });
}

function handleGoogleCalendarError(err: unknown, res: Response): boolean {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const details =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: unknown } }).response?.data
      : undefined;
  console.error('[Reminder] Google Calendar error:', message, details ?? err);

  const isTokenError =
    message.includes('invalid_grant') ||
    message.includes('expired') ||
    message.includes('revoked') ||
    message.includes('Token has been');
  const isEnvError = message.includes('must be set in .env') || message.includes('GOOGLE_');

  let displayMessage: string;
  if (isTokenError) {
    displayMessage =
      'Google Calendar connection expired or was revoked. Reconnect in Settings to create meetings with Meet links.';
  } else if (process.env.NODE_ENV !== 'production' && (isEnvError || message)) {
    displayMessage = message;
  } else if (isEnvError) {
    displayMessage =
      'Calendar not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and reconnect in Settings.';
  } else {
    displayMessage =
      'Calendar operation failed. Reconnect Google Calendar in Settings and try again.';
  }

  res.status(502).json({
    success: false,
    error: {
      code: 'GOOGLE_MEET_ERROR',
      message: displayMessage,
      detail: process.env.NODE_ENV !== 'production' && !isTokenError && !isEnvError ? String(message) : undefined,
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
  await mirrorReminderInteraction(reminder, req.user?.userId);
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

/** List reminders from MongoDB. Use ?upcoming=false to get all (including past); default is upcoming only. */
export async function getRemindersList(req: AuthenticatedRequest, res: Response): Promise<void> {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  const type = req.query.type as string | undefined;
  const upcoming = req.query.upcoming !== 'false';
  const reminders = upcoming
    ? await reminderService.findUpcoming(limit, type)
    : await reminderService.findAll(limit, type);
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
  await mirrorReminderInteraction(reminder, req.user?.userId);
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
