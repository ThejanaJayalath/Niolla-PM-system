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
  }[];
  status: InquiryStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type InquiryStatus = 'NEW' | 'PROPOSAL_SENT' | 'NEGOTIATING' | 'CONFIRMED' | 'LOST';
