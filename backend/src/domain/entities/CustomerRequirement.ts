export type RequirementPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RequirementStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DEFERRED';
export type RequirementSource = 'INQUIRY' | 'CALL' | 'MEETING' | 'MANUAL';

export interface CustomerRequirement {
  _id?: string;
  customerRef: string;
  inquiryRef?: string;
  projectRef?: string;
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
