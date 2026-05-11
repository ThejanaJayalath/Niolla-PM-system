export interface ProposalMilestone {
  title: string;
  description?: string;
  amount?: number;
  timePeriod?: string;
  dueDate?: string;
}

export type ProposalPaymentPlan = 'FULL_PAYMENT' | 'THREE_MONTH' | 'SIX_MONTH';

/** Lifecycle on the proposal record (distinct from inquiry status). */
export type ProposalStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'LOST';

export interface Proposal {
  _id?: string;
  inquiryId: string;
  status?: ProposalStatus;
  projectName?: string;
  customerName: string;
  /** Optional; may be blank when the inquiry had no description. */
  projectDescription?: string;
  requiredFeatures: string[];
  milestones: ProposalMilestone[];
  advancePayment?: number;
  projectCost?: number;
  totalAmount: number;
  paymentPlan?: ProposalPaymentPlan;
  installmentMonths?: number;
  monthlyInstallment?: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
