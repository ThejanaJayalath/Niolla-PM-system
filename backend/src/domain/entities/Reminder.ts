export interface Reminder {
  _id?: string;
  inquiryId?: string;
  customerName?: string;
  type: 'reminder' | 'meeting';
  title: string;
  description?: string;
  meetingLink?: string;
  scheduledAt: Date;
  notes?: string;
  completed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
