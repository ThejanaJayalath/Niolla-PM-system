import { Proposal, ProposalMilestone } from '../../domain/entities/Proposal';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';

export interface CreateProposalInput {
  inquiryId: string;
  projectName?: string;
  milestones: ProposalMilestone[];
  totalAmount: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
}

export class ProposalService {
  async create(data: CreateProposalInput): Promise<Proposal> {
    const inquiry = await InquiryModel.findById(data.inquiryId);
    if (!inquiry) throw new Error('Inquiry not found');

    const proposal = await ProposalModel.create({
      inquiryId: data.inquiryId,
      projectName: data.projectName,
      customerName: inquiry.customerName,
      projectDescription: inquiry.projectDescription,
      requiredFeatures: inquiry.requiredFeatures || [],
      milestones: data.milestones,
      totalAmount: data.totalAmount,
      maintenanceCostPerMonth: data.maintenanceCostPerMonth,
      maintenanceNote: data.maintenanceNote,
      validUntil: data.validUntil,
      notes: data.notes,
    });

    // Link proposal to Inquiry
    await InquiryModel.findByIdAndUpdate(data.inquiryId, {
      $push: {
        proposals: {
          _id: proposal._id,
          createdAt: proposal.createdAt,
          status: 'CREATED'
        }
      },
      // Auto-update status to PROPOSAL_SENT
      $set: { status: 'PROPOSAL_SENT' }
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

  async findAllByInquiryId(inquiryId: string): Promise<Proposal[]> {
    const docs = await ProposalModel.find({ inquiryId }).sort({ createdAt: -1 });
    return docs.map(d => d.toObject() as unknown as Proposal);
  }

  async findAll(): Promise<Proposal[]> {
    const docs = await ProposalModel.find().sort({ createdAt: -1 });
    return docs.map((d) => d.toObject() as unknown as Proposal);
  }
}
