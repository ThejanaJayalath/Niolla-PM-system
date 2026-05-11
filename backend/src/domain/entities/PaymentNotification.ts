export interface PaymentNotification {
  _id?: string;
  /** Customer (billing / payment flows). */
  clientId?: string;
  /** Staff user (e.g. project assignment). */
  userId?: string;
  installmentId?: string;
  type: 'sms' | 'email' | 'system';
  triggerType:
    | 'due_reminder'
    | 'overdue'
    | 'receipt'
    | 'assignment'
    | 'payout_review'
    /** Customer: new billable feature / add-on plan (separate from main contract). */
    | 'requirement_addon';
  scheduledAt: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
  messageBody?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
