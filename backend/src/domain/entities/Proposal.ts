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
  /** Subtotal before festival campaign discount (incl. plan markup when applicable). */
  originalAmount?: number;
  campaignDiscountAmount?: number;
  campaignId?: string;
  campaignName?: string;
  discountType?: 'percent' | 'flat';
  discountValue?: number;
  totalAmount: number;
  paymentPlan?: ProposalPaymentPlan;
  installmentMonths?: number;
  monthlyInstallment?: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
  /** Relative path under backend cwd, e.g. uploads/proposals/proposal-name-id.docx */
  documentPath?: string;
  documentFileName?: string;
  documentGeneratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
