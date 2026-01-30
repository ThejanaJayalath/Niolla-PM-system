export interface Reminder {
  _id?: string;
  inquiryId: string;
  type: 'reminder' | 'meeting';
  title: string;
  scheduledAt: Date;
  notes?: string;
  completed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
