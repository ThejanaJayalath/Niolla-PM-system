export interface Inquiry {
  _id?: string;
  customerId?: string;
  customerName: string;
  /** Business / shop name (optional). */
  companyName?: string;
  phoneNumber: string;
  /** Product line / stack interest (e.g. ERP, POS). */
  businessModel?: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes?: string;
  proposals?: {
    _id: string;
    createdAt: Date;
    status: 'CREATED' | 'DOWNLOADED' | 'CONFIRMED';
    projectName?: string;
  }[];
  status: InquiryStatus;
  /** Total advance received (from ADVANCE-type bills) for this inquiry. */
  totalAdvancePaid?: number;
  /** Total advance already applied (deducted on NORMAL/FINAL bills) for this inquiry. */
  totalAdvanceUsed?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  /** YYYY-MM-DD — prospect birthday for card automation */
  dateOfBirth?: string;
}

export type InquiryStatus =
  | 'NEW'
  | 'PROPOSAL_SENT'
  | 'NEGOTIATING'
  | 'PENDING_ADVANCE'
  | 'CONFIRMED'
  | 'LOST';
