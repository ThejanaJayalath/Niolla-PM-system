export interface PaymentNotification {
  _id?: string;
  clientId: string;
  installmentId?: string;
  type: 'sms' | 'email' | 'system';
  triggerType: 'due_reminder' | 'overdue' | 'receipt';
  scheduledAt: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
  messageBody?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
