export type UpdateTicketStatus =
  | 'REQUESTED'
  | 'PRICED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export interface UpdateTicketAssignee {
  _id: string;
  name: string;
}

export interface UpdateTicket {
  _id?: string;
  ticketId: string;
  customerRef: string;
  customerName?: string;
  projectRef: string;
  projectName?: string;
  productName?: string;
  title: string;
  description?: string;
  status: UpdateTicketStatus;
  /** Admin-set price for this update (LKR). */
  quotedPrice?: number;
  pricedAt?: Date;
  pricedBy?: string;
  pricedByName?: string;
  /** Customer sign-off recorded by admin. */
  approvedAt?: Date;
  approvedBy?: string;
  approvedByName?: string;
  assignedEmployeeIds?: string[];
  /** Primary assigned worker (first in list when one worker is assigned). */
  assignees?: UpdateTicketAssignee[];
  /** Amount paid to the worker for this update task (LKR). */
  workerPayoutValue?: number;
  /** @deprecated Use workerPayoutValue — kept for compatibility. */
  developerPayoutValue?: number;
  assignedAt?: Date;
  assignedBy?: string;
  assignedByName?: string;
  linkedRequirementId?: string;
  linkedPaymentPlanId?: string;
  linkedProjectTaskId?: string;
  requestedAt: Date;
  /** When the worker marked the update done (awaiting admin review). */
  workerSubmittedAt?: Date;
  completedAt?: Date;
  completedByWorker?: string;
  completedByWorkerName?: string;
  /** Admin sign-off after reviewing completed work. */
  adminApprovedAt?: Date;
  adminApprovedBy?: string;
  adminApprovedByName?: string;
  createdBy?: string;
  createdByName?: string;
  internalNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
