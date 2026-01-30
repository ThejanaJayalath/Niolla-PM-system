export interface ProposalMilestone {
  title: string;
  description?: string;
  amount: number;
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
  totalAmount: number;
  validUntil?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
