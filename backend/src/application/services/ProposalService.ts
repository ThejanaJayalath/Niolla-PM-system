import { Proposal, ProposalMilestone } from '../../domain/entities/Proposal';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';
import { CustomerService } from './CustomerService';

export interface CreateProposalInput {
  inquiryId: string;
  projectName?: string;
  milestones: ProposalMilestone[];
  advancePayment?: number;
  projectCost?: number;
  totalAmount: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
}

export class ProposalService {
  private customerService = new CustomerService();

  async create(data: CreateProposalInput): Promise<Proposal> {
    const inquiry = await InquiryModel.findById(data.inquiryId);
    if (!inquiry) throw new Error('Inquiry not found');

    // Generate Proposal ID
    const lastProposal = await ProposalModel.findOne().sort({ createdAt: -1 });
    let nextIdNumber = 1;
    if (lastProposal && lastProposal.proposalId) {
      const match = lastProposal.proposalId.match(/Proposal_num(\d+)/);
      if (match && match[1]) {
        nextIdNumber = parseInt(match[1], 10) + 1;
      }
    }
    const newProposalId = `Proposal_num${nextIdNumber.toString().padStart(2, '0')}`;

    const proposal = await ProposalModel.create({
      inquiryId: data.inquiryId,
      proposalId: newProposalId,
      projectName: data.projectName,
      customerName: inquiry.customerName,
      projectDescription: inquiry.projectDescription,
      requiredFeatures: inquiry.requiredFeatures || [],
      milestones: data.milestones,
      advancePayment: data.advancePayment,
      projectCost: data.projectCost,
      totalAmount: data.totalAmount,
      maintenanceCostPerMonth: data.maintenanceCostPerMonth,
      maintenanceNote: data.maintenanceNote,
      validUntil: data.validUntil,
      notes: data.notes,
    });

    // Link proposal to Inquiry (include Project Title so it's stored in inquiry tab)
    await InquiryModel.findByIdAndUpdate(data.inquiryId, {
      $push: {
        proposals: {
          _id: String(proposal._id),
          createdAt: proposal.createdAt,
          status: 'CREATED',
          projectName: proposal.projectName ?? data.projectName,
        },
      },
      // Auto-update status to PROPOSAL_SENT
      $set: { status: 'PROPOSAL_SENT' },
    });

    // If a customer exists for this inquiry, add the new projectName to their projects
    const projectName = proposal.projectName ?? data.projectName;
    if (projectName?.trim()) {
      const customer = await this.customerService.findByInquiryId(data.inquiryId);
      if (customer && customer._id) {
        const existing = customer.projects || [];
        if (!existing.includes(projectName.trim())) {
          await this.customerService.update(customer._id, {
            projects: [...existing, projectName.trim()],
          });
        }
      }
    }

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
  async delete(id: string): Promise<boolean> {
    const proposal = await ProposalModel.findById(id);
    if (!proposal) return false;

    // Remove from Inquiry (match _id as string, same as when we $push)
    await InquiryModel.findByIdAndUpdate(proposal.inquiryId, {
      $pull: { proposals: { _id: String(proposal._id) } },
    });

    await ProposalModel.findByIdAndDelete(id);
    return true;
  }

  async update(id: string, data: Partial<CreateProposalInput>): Promise<Proposal | null> {
    const proposal = await ProposalModel.findByIdAndUpdate(
      id,
      {
        $set: {
          projectName: data.projectName,
          milestones: data.milestones,
          advancePayment: data.advancePayment,
          projectCost: data.projectCost,
          totalAmount: data.totalAmount,
          maintenanceCostPerMonth: data.maintenanceCostPerMonth,
          maintenanceNote: data.maintenanceNote,
          validUntil: data.validUntil,
          notes: data.notes,
        },
      },
      { new: true }
    );
    if (proposal && data.projectName !== undefined) {
      const proposalIdStr = String(proposal._id);
      await InquiryModel.updateOne(
        { 'proposals._id': proposalIdStr },
        { $set: { 'proposals.$[p].projectName': data.projectName } },
        { arrayFilters: [{ 'p._id': proposalIdStr }] }
      );
    }
    return proposal ? (proposal.toObject() as unknown as Proposal) : null;
  }
}
