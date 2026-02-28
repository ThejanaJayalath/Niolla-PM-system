export interface Inquiry {
  _id?: string;
  customerId?: string;
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes?: string;
  proposals?: {
    _id: string;
    createdAt: Date;
    status: 'CREATED' | 'DOWNLOADED';
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
}

export type InquiryStatus = 'NEW' | 'PROPOSAL_SENT' | 'NEGOTIATING' | 'CONFIRMED' | 'LOST';
