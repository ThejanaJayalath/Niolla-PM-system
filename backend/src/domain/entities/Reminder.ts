export interface Reminder {
  _id?: string;
  inquiryId?: string;
  customerName?: string;
  type: 'reminder' | 'meeting';
  title: string;
  description?: string;
  meetingLink?: string;
  googleEventId?: string;
  scheduledAt: Date;
  notes?: string;
  status?: 'schedule' | 'overdue' | 'done' | 'cancel' | 'postpone';
  completed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
