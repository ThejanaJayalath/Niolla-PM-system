/**
 * Client for NioBot-Meet recording service (separate process on NIOBOT_API_URL).
 * @see https://github.com/SathiraSriSathsara/NioBot-Meet
 */

export type RecordingStatus =
  | 'none'
  | 'scheduled'
  | 'recording'
  | 'transcoding'
  | 'ready'
  | 'failed';

export interface NioBotRecordingInfo {
  status: RecordingStatus;
  watchUrl?: string;
  downloadUrl?: string;
  hlsUrl?: string;
  errorMessage?: string;
}

interface NioBotScheduleResponse {
  ok: boolean;
  id?: string;
  error?: string;
}

interface NioBotRecordingRow {
  status: string;
  watch_url?: string;
  download_url?: string;
  hls_url?: string;
  error_message?: string;
}

interface NioBotRecordingsResponse {
  ok: boolean;
  data?: NioBotRecordingRow[];
  error?: string;
}

function getBaseUrl(): string {
  return (process.env.NIOBOT_API_URL || 'http://localhost:5055').replace(/\/$/, '');
}

/** Format Date as MySQL datetime string in Asia/Colombo (NioBot API requirement). */
export function toColomboMysqlDatetime(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: 'Asia/Colombo' });
}

function mapNioBotStatus(raw?: string): RecordingStatus {
  switch ((raw || '').toUpperCase()) {
    case 'RECORDING':
      return 'recording';
    case 'TRANSCODING':
      return 'transcoding';
    case 'READY':
      return 'ready';
    case 'FAILED':
      return 'failed';
    case 'PENDING':
    default:
      return 'scheduled';
  }
}

export async function scheduleNioBotRecording(input: {
  title: string;
  meetUrl: string;
  scheduledAt: Date;
  durationMinutes: number;
  externalId?: string;
}): Promise<{ nioBotMeetingId: string }> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      meet_url: input.meetUrl,
      scheduled_at: toColomboMysqlDatetime(input.scheduledAt),
      duration_sec: Math.max(60, Math.round(input.durationMinutes * 60)),
      external_id: input.externalId,
    }),
  });

  const data = (await res.json()) as NioBotScheduleResponse;
  if (!res.ok || !data.ok || !data.id) {
    throw new Error(data.error || `NioBot schedule failed (${res.status})`);
  }
  return { nioBotMeetingId: data.id };
}

export async function fetchNioBotRecording(meetingId: string): Promise<NioBotRecordingInfo> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/recordings?meeting_id=${encodeURIComponent(meetingId)}`);
  const body = (await res.json()) as NioBotRecordingsResponse;

  if (!res.ok || !body.ok) {
    return { status: 'scheduled' };
  }

  const latest = body.data?.[0];
  if (!latest) {
    return { status: 'scheduled' };
  }

  return {
    status: mapNioBotStatus(latest.status),
    watchUrl: latest.watch_url,
    downloadUrl: latest.download_url,
    hlsUrl: latest.hls_url,
    errorMessage: latest.error_message,
  };
}

export function isNioBotEnabled(): boolean {
  return process.env.NIOBOT_ENABLED !== 'false';
}
