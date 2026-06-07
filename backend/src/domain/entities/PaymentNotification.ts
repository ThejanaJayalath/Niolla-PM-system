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
    /** Admin alert when a worker marks an update complete; customer alert when admin approves. */
    | 'status_notification'
    /** Customer: new billable feature / add-on plan (separate from main contract). */
    | 'requirement_addon'
    | 'birthday'
    | 'anniversary';
  scheduledAt: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
  messageBody?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
