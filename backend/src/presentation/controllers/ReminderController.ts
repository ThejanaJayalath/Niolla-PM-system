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
import { Reminder } from '../../domain/entities/Reminder';
import {
  fetchNioBotRecording,
  isNioBotEnabled,
  scheduleNioBotRecording,
} from '../../application/services/NioBotMeetService';

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

async function syncRecordingFromNioBot(reminder: Reminder): Promise<Reminder> {
  if (reminder.type !== 'meeting' || !reminder.nioBotMeetingId || !reminder._id) {
    return reminder;
  }
  try {
    const info = await fetchNioBotRecording(reminder.nioBotMeetingId);
    const changed =
      info.status !== reminder.recordingStatus ||
      info.watchUrl !== reminder.recordingWatchUrl ||
      info.downloadUrl !== reminder.recordingDownloadUrl ||
      info.errorMessage !== reminder.recordingErrorMessage;
    if (!changed) return reminder;
    const updated = await reminderService.update(reminder._id, {
      recordingStatus: info.status,
      recordingWatchUrl: info.watchUrl,
      recordingDownloadUrl: info.downloadUrl,
      recordingErrorMessage: info.errorMessage,
    });
    return updated || reminder;
  } catch (err) {
    console.error('[NioBot] recording sync failed:', err);
    return reminder;
  }
}

async function scheduleNioBotForReminder(reminder: Reminder): Promise<Reminder> {
  if (!reminder._id || !reminder.meetingLink) {
    throw new Error('Meeting has no Google Meet link');
  }
  if (!isNioBotEnabled()) {
    throw new Error('NioBot is disabled (set NIOBOT_ENABLED=true in backend .env)');
  }

  const reminderId = String(reminder._id);
  const durationMinutes = reminder.meetingDurationMinutes || 60;
  const scheduleAt =
    new Date(reminder.scheduledAt).getTime() > Date.now()
      ? new Date(reminder.scheduledAt)
      : new Date(Date.now() + 60_000);

  try {
    const { nioBotMeetingId } = await scheduleNioBotRecording({
      title: reminder.title,
      meetUrl: reminder.meetingLink,
      scheduledAt: scheduleAt,
      durationMinutes,
      externalId: reminderId,
    });
    const updated = await reminderService.update(reminderId, {
      nioBotMeetingId,
      recordingStatus: 'scheduled',
      recordingErrorMessage: undefined,
      recordingWatchUrl: undefined,
      recordingDownloadUrl: undefined,
    });
    return updated || reminder;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[NioBot] failed to schedule recording:', message);
    const updated = await reminderService.update(reminderId, {
      recordingStatus: 'failed',
      recordingErrorMessage: message,
    });
    return updated || reminder;
  }
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
    autoRecord,
  } = req.body;
  const scheduledDate = new Date(scheduledAt);
  const durationMinutes = meetingDurationMinutes ? Number(meetingDurationMinutes) : 60;

  let finalMeetingLink = typeof meetingLink === 'string' ? meetingLink.trim() : undefined;
  let googleEventId: string | undefined;
  const warnings: string[] = [];

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
      const message = err instanceof Error ? err.message : 'Google Calendar unavailable';
      console.error('[Reminder] Google Calendar error (continuing without auto Meet link):', message);
      if (finalMeetingLink) {
        warnings.push(
          'Google Calendar is not connected. Using the Meet link you provided. Connect Google in Settings to auto-create links.'
        );
      } else {
        warnings.push(
          'Google Calendar is not connected and no Meet link was provided. Meeting saved — add a Meet link on the meeting detail page for NioBot recording.'
        );
      }
    }
  }

  let reminder = await reminderService.create({
    inquiryId,
    customerName,
    type,
    title,
    description,
    meetingLink: finalMeetingLink,
    googleEventId,
    meetingDurationMinutes: type === 'meeting' ? durationMinutes : undefined,
    scheduledAt: scheduledDate,
    notes,
    status,
    recordingStatus: type === 'meeting' ? 'none' : undefined,
  });

  if (type === 'meeting' && finalMeetingLink && autoRecord !== false) {
    reminder = await scheduleNioBotForReminder({
      ...reminder,
      meetingLink: finalMeetingLink,
      meetingDurationMinutes: durationMinutes,
    });
  }

  await mirrorReminderInteraction(reminder, req.user?.userId);
  res.status(201).json({
    success: true,
    data: reminder,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}

export async function getReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
  let reminder = await reminderService.findById(req.params.id);
  if (!reminder) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }
  if (reminder.type === 'meeting' && reminder.nioBotMeetingId) {
    reminder = await syncRecordingFromNioBot(reminder);
  }
  res.json({ success: true, data: reminder });
}

export async function retryMeetingRecording(req: AuthenticatedRequest, res: Response): Promise<void> {
  const existing = await reminderService.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    return;
  }
  if (existing.type !== 'meeting') {
    res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Not a meeting' } });
    return;
  }
  if (!existing.meetingLink) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_MEET_LINK', message: 'Add a Google Meet link before scheduling recording' },
    });
    return;
  }

  const reminder = await scheduleNioBotForReminder(existing);
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
