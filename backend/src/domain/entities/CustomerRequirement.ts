export type RequirementPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RequirementStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DEFERRED';
export type RequirementSource =
  | 'INQUIRY'
  | 'CALL'
  | 'MEETING'
  | 'MANUAL'
  | 'CUSTOMER'
  | 'CUSTOMER_PORTAL';

export interface CustomerRequirement {
  _id?: string;
  customerRef: string;
  inquiryRef?: string;
  projectRef?: string;
  /** Developers assigned to implement this requirement (admin workflow). */
  assignedEmployeeIds?: string[];
  /** Agreed payout/value for this requirement (not the main project contract total). */
  requirementPayoutValue?: number;
  title: string;
  description?: string;
  priority: RequirementPriority;
  status: RequirementStatus;
  source: RequirementSource;
  capturedAt: Date;
  capturedBy?: string;
  lastUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
