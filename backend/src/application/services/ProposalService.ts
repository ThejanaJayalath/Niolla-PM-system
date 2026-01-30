import { Proposal, ProposalMilestone } from '../../domain/entities/Proposal';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';

export interface CreateProposalInput {
  inquiryId: string;
  milestones: ProposalMilestone[];
  totalAmount: number;
  validUntil?: string;
  notes?: string;
}

export class ProposalService {
  async create(data: CreateProposalInput): Promise<Proposal> {
    const inquiry = await InquiryModel.findById(data.inquiryId);
    if (!inquiry) throw new Error('Inquiry not found');

    const proposal = await ProposalModel.create({
      inquiryId: data.inquiryId,
      customerName: inquiry.customerName,
      projectDescription: inquiry.projectDescription,
      requiredFeatures: inquiry.requiredFeatures || [],
      milestones: data.milestones,
      totalAmount: data.totalAmount,
      validUntil: data.validUntil,
      notes: data.notes,
    });

    return proposal.toObject() as unknown as Proposal;
  }

  async findById(id: string): Promise<Proposal | null> {
    const doc = await ProposalModel.findById(id);
    return doc ? (doc.toObject() as unknown as Proposal) : null;
  }

  async findByInquiryId(inquiryId: string): Promise<Proposal | null> {
    const doc = await ProposalModel.findOne({ inquiryId }).sort({ createdAt: -1 });
    return doc ? (doc.toObject() as unknown as Proposal) : null;
  }
}
