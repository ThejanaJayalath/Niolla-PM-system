export interface Reminder {
  _id?: string;
  inquiryId?: string;
  customerName?: string;
  type: 'reminder' | 'meeting';
  title: string;
  description?: string;
  meetingLink?: string;
  googleEventId?: string;
  meetingDurationMinutes?: number;
  nioBotMeetingId?: string;
  recordingStatus?: 'none' | 'scheduled' | 'recording' | 'transcoding' | 'ready' | 'failed';
  recordingWatchUrl?: string;
  recordingDownloadUrl?: string;
  recordingErrorMessage?: string;
  scheduledAt: Date;
  notes?: string;
  status?: 'schedule' | 'overdue' | 'done' | 'cancel' | 'postpone';
  completed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
