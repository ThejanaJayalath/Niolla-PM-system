export interface ProposalMilestone {
  title: string;
  description?: string;
  amount?: number;
  timePeriod?: string;
  dueDate?: string;
}

export interface Proposal {
  _id?: string;
  inquiryId: string;
  projectName?: string;
  customerName: string;
  projectDescription: string;
  requiredFeatures: string[];
  milestones: ProposalMilestone[];
  advancePayment?: number;
  projectCost?: number;
  totalAmount: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
