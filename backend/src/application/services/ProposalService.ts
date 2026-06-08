import mongoose from 'mongoose';
import { Proposal, ProposalMilestone, ProposalStatus } from '../../domain/entities/Proposal';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';
import { CustomerService } from './CustomerService';
import { InvoiceService } from './InvoiceService';
import { CampaignService } from './CampaignService';

export interface CreateProposalInput {
  inquiryId: string;
  projectName?: string;
  milestones: ProposalMilestone[];
  advancePayment?: number;
  projectCost?: number;
  totalAmount: number;
  paymentPlan?: 'FULL_PAYMENT' | 'THREE_MONTH' | 'SIX_MONTH';
  installmentMonths?: number;
  monthlyInstallment?: number;
  maintenanceCostPerMonth?: number;
  maintenanceNote?: string;
  validUntil?: string;
  notes?: string;
  status?: ProposalStatus;
}

export class ProposalService {
  private customerService = new CustomerService();
  private invoiceService = new InvoiceService();
  private campaignService = new CampaignService();

  /** Next numeric suffix so `proposalId` stays unique even if the newest row uses a non-standard id. */
  private async getNextProposalIdNumber(): Promise<number> {
    const docs = await ProposalModel.find({ proposalId: /^Proposal_num\d+$/i })
      .select('proposalId')
      .lean();
    let max = 0;
    for (const d of docs) {
      const m = d.proposalId?.match(/^Proposal_num(\d+)$/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  }

  async create(data: CreateProposalInput): Promise<Proposal> {
    const inquiry = await InquiryModel.findById(data.inquiryId);
    if (!inquiry) throw new Error('Inquiry not found');

    const nextIdNumber = await this.getNextProposalIdNumber();
    const newProposalId = `Proposal_num${String(nextIdNumber).padStart(2, '0')}`;

    const subtotalBeforeDiscount = Number(data.totalAmount);
    const campaign = await this.campaignService.findBestActiveForInquiry(
      data.inquiryId,
      subtotalBeforeDiscount
    );

    let totalAmount = subtotalBeforeDiscount;
    let advancePayment = data.advancePayment;
    let monthlyInstallment = data.monthlyInstallment;
    let originalAmount: number | undefined;
    let campaignDiscountAmount: number | undefined;
    let campaignId: string | undefined;
    let campaignName: string | undefined;
    let discountType: 'percent' | 'flat' | undefined;
    let discountValue: number | undefined;

    if (campaign && subtotalBeforeDiscount > 0) {
      const breakdown = this.campaignService.applyCampaignToPrice(subtotalBeforeDiscount, campaign);
      originalAmount = breakdown.originalPrice;
      campaignDiscountAmount = breakdown.discountAmount;
      totalAmount = breakdown.finalPrice;
      campaignId = campaign._id;
      campaignName = campaign.name;
      discountType = campaign.discountType;
      discountValue = campaign.discountValue;
      if (advancePayment != null && subtotalBeforeDiscount > 0) {
        const ratio = Number(advancePayment) / subtotalBeforeDiscount;
        advancePayment = Math.round(totalAmount * ratio * 100) / 100;
      }
      if (monthlyInstallment != null && data.installmentMonths && data.installmentMonths > 0) {
        const adv = Number(advancePayment ?? totalAmount * 0.4);
        monthlyInstallment = Math.round(((totalAmount - adv) / data.installmentMonths) * 100) / 100;
      }
    }

    const proposal = await ProposalModel.create({
      inquiryId: data.inquiryId,
      proposalId: newProposalId,
      projectName: data.projectName,
      customerName: (inquiry.customerName ?? '').trim() || 'Customer',
      projectDescription: String(inquiry.projectDescription ?? '').trim(),
      requiredFeatures: inquiry.requiredFeatures || [],
      milestones: data.milestones,
      advancePayment,
      projectCost: data.projectCost,
      originalAmount,
      campaignDiscountAmount,
      campaignId: campaignId ? new mongoose.Types.ObjectId(campaignId) : undefined,
      campaignName,
      discountType,
      discountValue,
      totalAmount,
      paymentPlan: data.paymentPlan,
      installmentMonths: data.installmentMonths,
      monthlyInstallment,
      maintenanceCostPerMonth: data.maintenanceCostPerMonth,
      maintenanceNote: data.maintenanceNote,
      validUntil: data.validUntil,
      notes: data.notes,
      status: 'SENT',
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

  /** Contract value still owed after the advance (total − advance on latest proposal). */
  async getRemainingContractBalanceAfterAdvance(inquiryId: string): Promise<number> {
    const doc = await ProposalModel.findOne({ inquiryId }).sort({ createdAt: -1 }).lean();
    if (!doc) return 0;
    const total = Number(doc.totalAmount ?? 0);
    const adv = Number(doc.advancePayment ?? 0);
    return Math.max(0, total - adv);
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
    const doc = await ProposalModel.findById(id);
    if (!doc) return null;

    const prevStatus: ProposalStatus = (doc.status as ProposalStatus) || 'SENT';

    if (data.projectName !== undefined) doc.projectName = data.projectName;
    if (data.milestones !== undefined) doc.milestones = data.milestones;
    if (data.advancePayment !== undefined) doc.advancePayment = data.advancePayment;
    if (data.projectCost !== undefined) doc.projectCost = data.projectCost;
    if (data.totalAmount !== undefined) doc.totalAmount = data.totalAmount;
    if (data.paymentPlan !== undefined) doc.paymentPlan = data.paymentPlan;
    if (data.installmentMonths !== undefined) doc.installmentMonths = data.installmentMonths;
    if (data.monthlyInstallment !== undefined) doc.monthlyInstallment = data.monthlyInstallment;
    if (data.maintenanceCostPerMonth !== undefined) doc.maintenanceCostPerMonth = data.maintenanceCostPerMonth;
    if (data.maintenanceNote !== undefined) doc.maintenanceNote = data.maintenanceNote;
    if (data.validUntil !== undefined) doc.validUntil = data.validUntil;
    if (data.notes !== undefined) doc.notes = data.notes;
    if (data.status !== undefined) doc.status = data.status;

    await doc.save();
    const o = doc.toObject() as unknown as Proposal;

    if (data.status === 'CONFIRMED' && prevStatus !== 'CONFIRMED') {
      await this.onProposalConfirmed(o);
    }

    if (data.projectName !== undefined) {
      const proposalIdStr = String(doc._id);
      await InquiryModel.updateOne(
        { 'proposals._id': proposalIdStr },
        { $set: { 'proposals.$[p].projectName': data.projectName } },
        { arrayFilters: [{ 'p._id': proposalIdStr }] }
      );
    }
    return o;
  }

  /**
   * When the inquiry is set to CONFIRMED, align the latest proposal row + embedded stub (no duplicate invoice — already created in inquiry flow).
   */
  async syncLatestProposalConfirmedForInquiry(inquiryId: string): Promise<void> {
    const doc = await ProposalModel.findOne({ inquiryId }).sort({ createdAt: -1 });
    if (!doc) return;
    doc.status = 'CONFIRMED';
    await doc.save();
    const pid = String(doc._id);
    await InquiryModel.updateOne(
      { 'proposals._id': pid },
      { $set: { 'proposals.$.status': 'CONFIRMED' } }
    );
  }

  /** Insert advance invoice row; requires customer profile linked to inquiry (client_id). Shop name = inquiry.companyName. */
  private async onProposalConfirmed(proposal: Proposal): Promise<void> {
    if (!proposal._id) return;
    const inquiryId = String(proposal.inquiryId);
    const inquiry = await InquiryModel.findById(inquiryId).lean();
    if (!inquiry) return;

    const shopName = inquiry.companyName?.trim() || undefined;
    const customer = await this.customerService.findByInquiryId(inquiryId);
    if (!customer?._id) return;

    const projectLabel =
      proposal.projectName?.trim() || inquiry.projectDescription?.trim() || 'Project';

    await this.invoiceService.ensureProposalAdvanceInvoice({
      inquiryId,
      proposalId: String(proposal._id),
      clientId: String(customer._id),
      advanceAmount: Number(proposal.advancePayment ?? 0),
      projectLabel,
      companyName: shopName,
      projectName: proposal.projectName?.trim() || undefined,
    });

    const proposalIdStr = String(proposal._id);
    await InquiryModel.updateOne(
      { 'proposals._id': proposalIdStr },
      { $set: { 'proposals.$.status': 'CONFIRMED' } }
    );
  }
}
