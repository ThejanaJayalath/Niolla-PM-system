import { google } from 'googleapis';
import { getGoogleRefreshToken } from './IntegrationService';

const CALENDAR_ID = 'primary';
const DEFAULT_DURATION_MINUTES = 60;
const TIMEZONE = 'Asia/Colombo';

async function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env (OAuth2).'
    );
  }
  const refreshToken =
    (await getGoogleRefreshToken()) || process.env.GOOGLE_REFRESH_TOKEN || '';
  if (!refreshToken) {
    throw new Error(
      'No Google Calendar refresh token. Connect Google Calendar in Settings (or set GOOGLE_REFRESH_TOKEN in .env).'
    );
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

/** Run a calendar API fn; on 401/403 refresh token and retry once (token auto-refresh safety). */
async function withCalendarAuth<T>(
  fn: (calendar: ReturnType<typeof google.calendar>) => Promise<T>
): Promise<T> {
  const auth = await getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    return await fn(calendar);
  } catch (err: unknown) {
    const status = err && typeof err === 'object' && 'code' in err ? (err as { code?: number }).code : undefined;
    const isAuthError = status === 401 || status === 403;
    if (isAuthError) {
      try {
        const { credentials } = await auth.refreshAccessToken();
        auth.setCredentials(credentials);
        return await fn(calendar);
      } catch (refreshErr) {
        console.error('[GoogleCalendar] Token refresh failed:', refreshErr);
        throw new Error('Calendar access expired. Re-run OAuth to get a new refresh token.');
      }
    }
    throw err;
  }
}

export interface CreateMeetingInput {
  title: string;
  description?: string;
  startTime: Date;
  durationMinutes?: number;
  /** Attendee emails; they receive invitations when sendInvites is true */
  attendees?: string[];
  /** If true, Google sends email invitations to attendees */
  sendInvites?: boolean;
  /** Recurrence rules, e.g. ['RRULE:FREQ=WEEKLY;COUNT=5'] or ['RRULE:FREQ=DAILY;INTERVAL=1'] */
  recurrence?: string[];
}

export interface CreateMeetingResult {
  meetLink: string;
  googleEventId: string;
  startTime: Date;
  endTime: Date;
}

export async function createGoogleMeetEvent(input: CreateMeetingInput): Promise<CreateMeetingResult> {
  return withCalendarAuth(async (calendar) => {
    const durationMinutes = input.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    const start = new Date(input.startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const event: Record<string, unknown> = {
      summary: input.title,
      description: input.description ?? 'Auto generated meeting',
      start: {
        dateTime: new Date(start).toISOString(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: new Date(end).toISOString(),
        timeZone: TIMEZONE,
      },
      conferenceData: {
        createRequest: {
          requestId: Date.now().toString(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    if (input.attendees && input.attendees.length > 0) {
      event.attendees = input.attendees.map((email) => ({ email: email.trim() })).filter((a) => a.email);
    }
    if (input.recurrence && input.recurrence.length > 0) {
      event.recurrence = input.recurrence;
    }

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: input.sendInvites ? 'all' : undefined,
    });

    const googleEventId = response.data.id;
    if (!googleEventId) {
      throw new Error('Google Calendar did not return an event id');
    }

    let meetLink =
      response.data.hangoutLink ||
      response.data.conferenceData?.entryPoints?.[0]?.uri;

    if (!meetLink) {
      const refreshed = await calendar.events.get({ calendarId: CALENDAR_ID, eventId: googleEventId });
      meetLink =
        refreshed.data.hangoutLink ||
        refreshed.data.conferenceData?.entryPoints?.[0]?.uri;
    }
    if (!meetLink && response.data.htmlLink) {
      meetLink = response.data.htmlLink;
    }
    if (!meetLink) {
      throw new Error('Google Calendar created the event but returned no link.');
    }

    return {
      meetLink,
      googleEventId,
      startTime: start,
      endTime: end,
    };
  });
}

export interface UpdateMeetingInput {
  startTime: Date;
  endTime?: Date;
  summary?: string;
  description?: string;
}

/** Reschedule or update a calendar event. */
export async function updateGoogleMeetEvent(
  eventId: string,
  input: UpdateMeetingInput
): Promise<void> {
  await withCalendarAuth(async (calendar) => {
    const start = new Date(input.startTime);
    const end = input.endTime
      ? new Date(input.endTime)
      : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
    const patch: Record<string, unknown> = {
      start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
    };
    if (input.summary != null) patch.summary = input.summary;
    if (input.description != null) patch.description = input.description;

    await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: patch,
      sendUpdates: 'all',
    });
  });
}

/** Cancel/delete a calendar event; optionally notify attendees. */
export async function deleteGoogleMeetEvent(
  eventId: string,
  options?: { notifyAttendees?: boolean }
): Promise<void> {
  await withCalendarAuth(async (calendar) => {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
      sendUpdates: options?.notifyAttendees ? 'all' : 'none',
    });
  });
}
