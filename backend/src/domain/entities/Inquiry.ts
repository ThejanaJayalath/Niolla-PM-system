export interface Inquiry {
  _id?: string;
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes?: string;
  status: InquiryStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type InquiryStatus = 'new' | 'contacted' | 'proposal_sent' | 'negotiating' | 'won' | 'lost';
