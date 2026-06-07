import { Invoice } from '../../domain/entities/Invoice';
import type { IncomeInvoiceType } from '../../domain/incomeInvoiceType';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { InstallmentModel } from '../../infrastructure/database/models/InstallmentModel';
import mongoose from 'mongoose';
import { MasterLedgerService } from './MasterLedgerService';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { CampaignService } from './CampaignService';
import {
  deriveDiscountLinesFromFinalPayable,
  type DiscountType,
} from '../../domain/campaignDiscount';

/** First sequence number for `INV-YYYYMM-####` when no invoice exists yet for that month. */
const INVOICE_MONTHLY_SEQUENCE_START = 789;

export interface CreateInvoiceInput {
  transactionId?: string;
  inquiryId?: string;
  proposalId?: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  taxAmount?: number;
  discountAmt?: number;
  originalAmount?: number;
  campaignId?: string;
  campaignName?: string;
  discountType?: DiscountType;
  discountValue?: number;
  status?: 'draft' | 'sent' | 'paid' | 'pending';
  sourceType?: 'PAYMENT' | 'PROPOSAL_ADVANCE';
  invoiceType?: IncomeInvoiceType;
  description?: string;
  projectName?: string;
  companyName?: string;
}

export interface ListInvoicesFilters {
  clientId?: string;
  status?: string;
  inquiryId?: string;
}

const masterLedgerService = new MasterLedgerService();

type ProposalDiscountSource = {
  originalAmount?: number;
  campaignDiscountAmount?: number;
  totalAmount: number;
  campaignId?: unknown;
  campaignName?: string;
  discountType?: DiscountType;
  discountValue?: number;
};

export type CampaignDiscountLines = {
  originalAmount?: number;
  discountAmt?: number;
  campaignId?: mongoose.Types.ObjectId;
  campaignName?: string;
  discountType?: DiscountType;
  discountValue?: number;
};

export class InvoiceService {
  private campaignService = new CampaignService();

  /**
   * At invoice generation: use proposal snapshot, else best campaign active on current_date.
   * Returns separate accounting fields (original, discount, campaign) without changing final payable.
   */
  async resolveCampaignDiscountAtInvoiceTime(args: {
    /** Final amount collected / due on this invoice line. */
    lineAmount: number;
    clientId: string;
    inquiryId?: string;
    proposal?: ProposalDiscountSource | null;
    /** When true, lineAmount is pre-discount grand total (advance quote before discount). */
    grandTotalIsPreDiscount?: boolean;
  }): Promise<CampaignDiscountLines> {
    const lineAmount = Number(args.lineAmount);
    if (!Number.isFinite(lineAmount) || lineAmount <= 0) return {};

    if (args.proposal) {
      const fromProposal = this.scaleProposalDiscountToLine(args.proposal, lineAmount);
      if ((fromProposal.discountAmt ?? 0) > 0) return fromProposal;
    }

    let inquiryId = args.inquiryId;
    if (!inquiryId && mongoose.Types.ObjectId.isValid(args.clientId)) {
      const customer = await CustomerModel.findById(args.clientId).select('inquiryId').lean();
      inquiryId = customer?.inquiryId ? String(customer.inquiryId) : undefined;
    }

    const preDiscountGrand = args.grandTotalIsPreDiscount
      ? lineAmount
      : args.proposal
        ? Number(args.proposal.originalAmount) > 0
          ? Number(args.proposal.originalAmount)
          : Number(args.proposal.totalAmount) || lineAmount
        : lineAmount;

    let campaign = null;
    if (inquiryId && mongoose.Types.ObjectId.isValid(inquiryId)) {
      campaign = await this.campaignService.findBestActiveForInquiry(inquiryId, preDiscountGrand);
    } else {
      const productId = await this.resolveProductIdForClient(args.clientId);
      if (productId) {
        campaign = await this.campaignService.findBestActiveCampaign(String(productId), preDiscountGrand);
      }
    }
    if (!campaign) return {};

    const { discountType, discountValue } = this.campaignService.getCampaignDiscountFields(campaign);
    const campaignMeta = {
      campaignId: campaign._id
        ? new mongoose.Types.ObjectId(campaign._id)
        : undefined,
      campaignName: campaign.name,
      discountType,
      discountValue,
    };

    if (args.grandTotalIsPreDiscount) {
      const breakdown = this.campaignService.applyCampaignToPrice(preDiscountGrand, campaign);
      if (breakdown.discountAmount <= 0) return {};
      return {
        originalAmount: breakdown.originalPrice,
        discountAmt: breakdown.discountAmount,
        ...campaignMeta,
      };
    }

    if (args.proposal && Number(args.proposal.totalAmount) > 0) {
      const contractBase =
        Number(args.proposal.originalAmount) > 0
          ? Number(args.proposal.originalAmount)
          : Number(args.proposal.totalAmount);
      const contractBreakdown = this.campaignService.applyCampaignToPrice(contractBase, campaign);
      if (contractBreakdown.finalPrice > 0 && contractBreakdown.discountAmount > 0) {
        const ratio = lineAmount / contractBreakdown.finalPrice;
        return {
          originalAmount: Math.round(contractBreakdown.originalPrice * ratio * 100) / 100,
          discountAmt: Math.round(contractBreakdown.discountAmount * ratio * 100) / 100,
          ...campaignMeta,
        };
      }
    }

    const derived = deriveDiscountLinesFromFinalPayable(lineAmount, discountType, discountValue);
    if (!derived || derived.discountAmount <= 0) return {};
    return {
      originalAmount: derived.originalPrice,
      discountAmt: derived.discountAmount,
      ...campaignMeta,
    };
  }

  scaleProposalDiscountToLine(proposal: ProposalDiscountSource, lineAmount: number): CampaignDiscountLines {
    const discount = Number(proposal.campaignDiscountAmount) || 0;
    const original = Number(proposal.originalAmount) || 0;
    const contractTotal = Number(proposal.totalAmount) || 0;
    if (discount <= 0 || original <= 0 || contractTotal <= 0) return {};
    const ratio = lineAmount / contractTotal;
    const campaignIdRaw = proposal.campaignId;
    const campaignId =
      campaignIdRaw && mongoose.Types.ObjectId.isValid(String(campaignIdRaw))
        ? new mongoose.Types.ObjectId(String(campaignIdRaw))
        : undefined;
    return {
      originalAmount: Math.round(original * ratio * 100) / 100,
      discountAmt: Math.round(discount * ratio * 100) / 100,
      campaignId,
      campaignName: proposal.campaignName,
      discountType: proposal.discountType,
      discountValue: proposal.discountValue,
    };
  }

  private async resolveProductIdForClient(clientId: string): Promise<mongoose.Types.ObjectId | undefined> {
    if (!mongoose.Types.ObjectId.isValid(clientId)) return undefined;
    const customer = await CustomerModel.findById(clientId).select('productId').lean();
    const pid = customer?.productId;
    if (!pid) return undefined;
    return pid instanceof mongoose.Types.ObjectId ? pid : new mongoose.Types.ObjectId(String(pid));
  }

  /**
   * Classifies installment-backed payments: last installment in the plan = balance settlement;
   * earlier installments = monthly (recurring) collections.
   */
  async resolveInvoiceTypeForPaymentTransaction(transactionId: string): Promise<IncomeInvoiceType> {
    const tx = await PaymentTransactionModel.findById(transactionId).select('installmentId').lean();
    if (!tx?.installmentId) return 'MONTHLY_INSTALLMENT';
    const inst = await InstallmentModel.findById(tx.installmentId)
      .populate({ path: 'planId', select: 'totalInstallments' })
      .lean();
    if (!inst) return 'MONTHLY_INSTALLMENT';
    const plan = inst.planId as { totalInstallments?: number } | null;
    const total = Math.max(1, Number(plan?.totalInstallments) || 1);
    const no = Number(inst.installmentNo) || 1;
    return no >= total ? 'BALANCE_PAYMENT' : 'MONTHLY_INSTALLMENT';
  }

  async getNextInvoiceNumber(): Promise<string> {
    const prefix = 'INV-';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const pattern = new RegExp(`^${prefix}${year}${month}-(\\d+)$`);
    const last = await InvoiceModel.find({ invoiceNumber: pattern })
      .sort({ invoiceNumber: -1 })
      .limit(1)
      .select('invoiceNumber')
      .lean();
    const nextSeq = last.length > 0
      ? parseInt((last[0].invoiceNumber as string).match(pattern)?.[1] || '0', 10) + 1
      : INVOICE_MONTHLY_SEQUENCE_START;
    return `${prefix}${year}${month}-${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Idempotent for the active proposal flow:
   * - If latest advance invoice is unpaid, refresh it with latest proposal values.
   * - If latest advance invoice is already paid, create a new advance invoice.
   */
  async ensureProposalAdvanceInvoice(args: {
    inquiryId: string;
    proposalId: string;
    clientId: string;
    advanceAmount: number;
    projectLabel: string;
    companyName?: string;
    projectName?: string;
    /**
     * Optional explicit number (rare). By default uses `getNextInvoiceNumber()` (sequence from 789 per month).
     */
    invoiceNumber?: string;
  }): Promise<Invoice | null> {
    const amount = Number(args.advanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const latest = await InvoiceModel.findOne({ inquiryId: args.inquiryId, sourceType: 'PROPOSAL_ADVANCE' })
      .sort({ createdAt: -1 });
    const proposal = await ProposalModel.findById(args.proposalId).lean();
    const discountFields = await this.resolveCampaignDiscountAtInvoiceTime({
      lineAmount: amount,
      clientId: args.clientId,
      inquiryId: args.inquiryId,
      proposal: proposal ?? undefined,
    });

    if (latest && latest.status !== 'paid') {
      latest.proposalId = args.proposalId as unknown as typeof latest.proposalId;
      latest.clientId = args.clientId as unknown as typeof latest.clientId;
      const productId = await this.resolveProductIdForClient(args.clientId);
      if (productId) latest.productId = productId;
      latest.totalAmount = amount;
      if (discountFields.originalAmount != null) latest.originalAmount = discountFields.originalAmount;
      if (discountFields.discountAmt != null) latest.discountAmt = discountFields.discountAmt;
      if (discountFields.campaignId) latest.campaignId = discountFields.campaignId;
      if (discountFields.campaignName) latest.campaignName = discountFields.campaignName;
      if (discountFields.discountType) latest.discountType = discountFields.discountType;
      if (discountFields.discountValue != null) latest.discountValue = discountFields.discountValue;
      latest.description = `Advance Payment (40%) for ${args.projectLabel}`;
      latest.projectName = args.projectName;
      latest.companyName = args.companyName;
      latest.invoiceDate = new Date();
      if (latest.status === 'draft' || latest.status === 'sent') {
        latest.status = 'pending';
      }
      latest.invoiceType = 'ADVANCE_PAYMENT';
      await latest.save();
      return this.toInvoice(latest);
    }
    const invoiceNumber =
      args.invoiceNumber?.trim() || (await this.getNextInvoiceNumber());
    return this.create({
      inquiryId: args.inquiryId,
      proposalId: args.proposalId,
      clientId: args.clientId,
      invoiceNumber,
      invoiceDate: new Date(),
      totalAmount: amount,
      originalAmount: discountFields.originalAmount,
      discountAmt: discountFields.discountAmt,
      campaignId: discountFields.campaignId ? String(discountFields.campaignId) : undefined,
      campaignName: discountFields.campaignName,
      discountType: discountFields.discountType,
      discountValue: discountFields.discountValue,
      status: 'pending',
      sourceType: 'PROPOSAL_ADVANCE',
      invoiceType: 'ADVANCE_PAYMENT',
      description: `Advance Payment (40%) for ${args.projectLabel}`,
      projectName: args.projectName,
      companyName: args.companyName,
    });
  }

  private async enrichCreateInputWithCampaign(data: CreateInvoiceInput): Promise<CreateInvoiceInput> {
    if (data.discountAmt != null || data.campaignId || data.originalAmount != null) return data;

    const lineAmount = Number(data.totalAmount);
    if (!Number.isFinite(lineAmount) || lineAmount <= 0) return data;

    let proposal: ProposalDiscountSource | null = null;
    if (data.proposalId && mongoose.Types.ObjectId.isValid(data.proposalId)) {
      proposal = await ProposalModel.findById(data.proposalId).lean();
    }

    const lines = await this.resolveCampaignDiscountAtInvoiceTime({
      lineAmount,
      clientId: data.clientId,
      inquiryId: data.inquiryId,
      proposal: proposal ?? undefined,
      grandTotalIsPreDiscount: !data.transactionId && data.sourceType !== 'PROPOSAL_ADVANCE',
    });

    if ((lines.discountAmt ?? 0) <= 0) return data;

    const enriched: CreateInvoiceInput = {
      ...data,
      originalAmount: lines.originalAmount,
      discountAmt: lines.discountAmt,
      campaignId: lines.campaignId ? String(lines.campaignId) : undefined,
      campaignName: lines.campaignName,
      discountType: lines.discountType,
      discountValue: lines.discountValue,
    };

    if (!data.transactionId && data.sourceType !== 'PROPOSAL_ADVANCE') {
      enriched.totalAmount =
        lines.originalAmount != null
          ? Math.round((lines.originalAmount - (lines.discountAmt ?? 0)) * 100) / 100
          : Math.max(0, Math.round((lineAmount - (lines.discountAmt ?? 0)) * 100) / 100);
    }

    return enriched;
  }

  async create(data: CreateInvoiceInput): Promise<Invoice> {
    const enriched = await this.enrichCreateInputWithCampaign(data);
    const productId = await this.resolveProductIdForClient(enriched.clientId);
    const doc = await InvoiceModel.create({
      transactionId: enriched.transactionId,
      inquiryId: enriched.inquiryId,
      proposalId: enriched.proposalId,
      clientId: enriched.clientId,
      productId,
      invoiceNumber: enriched.invoiceNumber,
      invoiceDate: enriched.invoiceDate instanceof Date ? enriched.invoiceDate : new Date(enriched.invoiceDate),
      totalAmount: Number(enriched.totalAmount),
      originalAmount: enriched.originalAmount !== undefined ? Number(enriched.originalAmount) : undefined,
      taxAmount: enriched.taxAmount !== undefined ? Number(enriched.taxAmount) : undefined,
      discountAmt: enriched.discountAmt !== undefined ? Number(enriched.discountAmt) : undefined,
      campaignId:
        enriched.campaignId && mongoose.Types.ObjectId.isValid(enriched.campaignId)
          ? new mongoose.Types.ObjectId(enriched.campaignId)
          : undefined,
      campaignName: enriched.campaignName,
      discountType: enriched.discountType,
      discountValue: enriched.discountValue,
      status: enriched.status || 'paid',
      sourceType: enriched.sourceType || 'PAYMENT',
      invoiceType: enriched.invoiceType,
      description: enriched.description,
      projectName: enriched.projectName,
      companyName: enriched.companyName,
    });
    const invoice = this.toInvoice(doc);
    if (invoice.status === 'paid' && invoice._id) {
      try {
        await masterLedgerService.recordInvoicePaid(invoice._id);
      } catch {
        /* non-fatal */
      }
    }
    return invoice;
  }

  async hasProposalAdvanceInvoice(inquiryId: string): Promise<boolean> {
    const doc = await InvoiceModel.findOne({ inquiryId, sourceType: 'PROPOSAL_ADVANCE' }).select('_id').lean();
    return !!doc;
  }

  async findProposalAdvanceByInquiryId(inquiryId: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findOne({ inquiryId, sourceType: 'PROPOSAL_ADVANCE' })
      .sort({ createdAt: -1 })
      .populate('clientId', 'name companyName email');
    return doc ? this.toInvoice(doc) : null;
  }

  async findById(id: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findById(id)
      .populate('transactionId', 'amount paymentDate paymentMethod referenceNo')
      .populate('clientId', 'name companyName email');
    return doc ? this.toInvoice(doc) : null;
  }

  async findByTransactionId(transactionId: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findOne({ transactionId })
      .populate('clientId', 'name companyName email');
    return doc ? this.toInvoice(doc) : null;
  }

  /**
   * Idempotent: creates a paid PAYMENT invoice for an installment transaction, or returns the existing one.
   * Used when recording a payment and from POST /billing/generate/:transactionId.
   */
  async ensureInvoiceForPaymentTransaction(
    transactionId: string
  ): Promise<{ invoice: Invoice; created: boolean }> {
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      throw new Error('Invalid transaction id');
    }
    const existing = await this.findByTransactionId(transactionId);
    if (existing) {
      return { invoice: existing, created: false };
    }
    const tx = await PaymentTransactionModel.findById(transactionId).lean();
    if (!tx) {
      throw new Error('Transaction not found');
    }
    const clientId =
      tx.clientId && typeof (tx.clientId as { toString?: () => string }).toString === 'function'
        ? (tx.clientId as { toString: () => string }).toString()
        : String(tx.clientId);
    const invoiceNumber = await this.getNextInvoiceNumber();
    const invoiceType = await this.resolveInvoiceTypeForPaymentTransaction(transactionId);
    const amount = Number(tx.amount);
    let inquiryId: string | undefined;
    let proposal: ProposalDiscountSource | null = null;
    const installment = tx.installmentId
      ? await InstallmentModel.findById(tx.installmentId).select('planId').populate('planId', 'projectId').lean()
      : null;
    const plan = installment?.planId as { projectId?: mongoose.Types.ObjectId } | null;
    if (plan?.projectId) {
      const project = await ProjectModel.findById(plan.projectId).select('clientId').lean();
      const clientOid = project?.clientId;
      if (clientOid) {
        const customer = await CustomerModel.findById(clientOid).select('inquiryId').lean();
        if (customer?.inquiryId) {
          inquiryId = String(customer.inquiryId);
          proposal = await ProposalModel.findOne({ inquiryId: customer.inquiryId })
            .sort({ createdAt: -1 })
            .lean();
        }
      }
    }

    const discountLines = await this.resolveCampaignDiscountAtInvoiceTime({
      lineAmount: amount,
      clientId,
      inquiryId,
      proposal: proposal ?? undefined,
    });

    const invoice = await this.create({
      transactionId,
      clientId,
      inquiryId,
      invoiceNumber,
      invoiceDate: new Date(tx.paymentDate as Date),
      totalAmount: amount,
      originalAmount: discountLines.originalAmount,
      discountAmt: discountLines.discountAmt,
      campaignId: discountLines.campaignId ? String(discountLines.campaignId) : undefined,
      campaignName: discountLines.campaignName,
      discountType: discountLines.discountType,
      discountValue: discountLines.discountValue,
      status: 'paid',
      sourceType: 'PAYMENT',
      invoiceType,
    });
    return { invoice, created: true };
  }

  async findByClientId(clientId: string): Promise<Invoice[]> {
    const docs = await InvoiceModel.find({ clientId })
      .populate('clientId', 'name companyName email')
      .sort({ invoiceDate: -1 });
    return docs.map((d) => this.toInvoice(d));
  }

  async findAll(filters?: ListInvoicesFilters): Promise<Invoice[]> {
    const query: Record<string, unknown> = {};
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.status) query.status = filters.status;
    if (filters?.inquiryId) query.inquiryId = filters.inquiryId;
    const docs = await InvoiceModel.find(query)
      .populate('clientId', 'name companyName email')
      .sort({ invoiceDate: -1 });
    const invoices = docs.map((d) => this.toInvoice(d));
    await this.enrichMissingInvoiceTypes(invoices);
    return invoices;
  }

  private async enrichMissingInvoiceTypes(invoices: Invoice[]): Promise<void> {
    const paymentRows = invoices.filter(
      (i) => !i.invoiceType && i.sourceType === 'PAYMENT' && i.transactionId
    );
    const typeByTxId: Record<string, IncomeInvoiceType> = {};
    if (paymentRows.length > 0) {
      const txIds = [...new Set(paymentRows.map((i) => i.transactionId as string))].filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      const txs = await PaymentTransactionModel.find({ _id: { $in: txIds } })
        .select('installmentId')
        .lean();
      const instIds = txs.map((t) => t.installmentId).filter(Boolean) as mongoose.Types.ObjectId[];
      const insts = await InstallmentModel.find({ _id: { $in: instIds } })
        .populate({ path: 'planId', select: 'totalInstallments' })
        .lean();
      const instById = Object.fromEntries(insts.map((i) => [i._id.toString(), i]));
      for (const t of txs) {
        const iid = t.installmentId?.toString();
        if (!iid) continue;
        const inst = instById[iid];
        if (!inst) {
          typeByTxId[t._id.toString()] = 'MONTHLY_INSTALLMENT';
          continue;
        }
        const plan = inst.planId as { totalInstallments?: number } | null;
        const total = Math.max(1, Number(plan?.totalInstallments) || 1);
        const no = Number(inst.installmentNo) || 1;
        typeByTxId[t._id.toString()] = no >= total ? 'BALANCE_PAYMENT' : 'MONTHLY_INSTALLMENT';
      }
    }
    for (const inv of invoices) {
      if (inv.invoiceType) continue;
      if (inv.sourceType === 'PROPOSAL_ADVANCE') {
        inv.invoiceType = 'ADVANCE_PAYMENT';
        continue;
      }
      if (inv.transactionId && typeByTxId[inv.transactionId]) {
        inv.invoiceType = typeByTxId[inv.transactionId];
      }
    }
  }

  /** Paid invoices with `invoiceType` resolved for income reporting. */
  async paidInvoicesForIncomeTracking(): Promise<Invoice[]> {
    const docs = await InvoiceModel.find({ status: 'paid' })
      .populate('clientId', 'name companyName email')
      .sort({ invoiceDate: -1 });
    const invoices = docs.map((d) => this.toInvoice(d));
    await this.enrichMissingInvoiceTypes(invoices);
    return invoices;
  }

  async markEmailed(id: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findByIdAndUpdate(
      id,
      { $set: { emailedAt: new Date() } },
      { new: true }
    )
      .populate('clientId', 'name companyName email');
    return doc ? this.toInvoice(doc) : null;
  }

  /** After notifying customer: record emailed time and promote pending/draft to sent. */
  async updateStatus(
    id: string,
    status: 'draft' | 'sent' | 'paid' | 'pending'
  ): Promise<{ invoice: Invoice | null; previousStatus: string | undefined }> {
    const current = await InvoiceModel.findById(id).lean();
    if (!current) return { invoice: null, previousStatus: undefined };
    const previousStatus = current.status as string;
    const doc = await InvoiceModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).populate('clientId', 'name companyName email');
    const invoice = doc ? this.toInvoice(doc) : null;
    if (invoice?._id) {
      try {
        if (status === 'paid') {
          await masterLedgerService.recordInvoicePaid(invoice._id);
        } else if (previousStatus === 'paid') {
          await masterLedgerService.removeInvoiceIncome(invoice._id);
        }
      } catch {
        /* non-fatal */
      }
    }
    return { invoice, previousStatus };
  }

  async markCustomerNotified(id: string): Promise<Invoice | null> {
    const current = await InvoiceModel.findById(id).select('status').lean();
    if (!current) return null;
    const set: Record<string, unknown> = { emailedAt: new Date() };
    if (current.status === 'pending' || current.status === 'draft') {
      set.status = 'sent';
    }
    const doc = await InvoiceModel.findByIdAndUpdate(id, { $set: set }, { new: true }).populate(
      'clientId',
      'name companyName email'
    );
    return doc ? this.toInvoice(doc) : null;
  }

  private toInvoice(doc: { toObject: () => Record<string, unknown> }): Invoice {
    const o = doc.toObject();
    const client = o.clientId as { _id?: unknown; name?: string; companyName?: string } | null;
    const txId = o.transactionId as { _id?: unknown } | null;
    const inv: Invoice = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      transactionId: txId && typeof txId === 'object' && txId._id
        ? (txId._id as { toString: () => string }).toString()
        : (o.transactionId as string | undefined),
      inquiryId: o.inquiryId ? (o.inquiryId as { toString: () => string }).toString() : undefined,
      clientId: client && typeof client === 'object' && client._id
        ? (client._id as { toString: () => string }).toString()
        : (o.clientId as string),
      invoiceNumber: o.invoiceNumber as string,
      invoiceDate: o.invoiceDate as Date,
      totalAmount: Number(o.totalAmount),
      status: o.status as 'draft' | 'sent' | 'paid' | 'pending',
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
    if (o.taxAmount !== undefined) inv.taxAmount = Number(o.taxAmount);
    if (o.originalAmount !== undefined) inv.originalAmount = Number(o.originalAmount);
    if (o.discountAmt !== undefined) inv.discountAmt = Number(o.discountAmt);
    if (o.campaignId) {
      inv.campaignId =
        typeof o.campaignId === 'object' && o.campaignId !== null && 'toString' in o.campaignId
          ? (o.campaignId as { toString: () => string }).toString()
          : String(o.campaignId);
    }
    if (o.campaignName) inv.campaignName = o.campaignName as string;
    if (o.discountType) inv.discountType = o.discountType as DiscountType;
    if (o.discountValue !== undefined) inv.discountValue = Number(o.discountValue);
    if (o.proposalId) {
      inv.proposalId =
        typeof o.proposalId === 'object' && o.proposalId !== null && 'toString' in o.proposalId
          ? (o.proposalId as { toString: () => string }).toString()
          : String(o.proposalId);
    }
    if (o.productId) {
      inv.productId =
        typeof o.productId === 'object' && o.productId !== null && 'toString' in o.productId
          ? (o.productId as { toString: () => string }).toString()
          : String(o.productId);
    }
    if (o.sourceType) inv.sourceType = o.sourceType as 'PAYMENT' | 'PROPOSAL_ADVANCE';
    if (o.invoiceType) inv.invoiceType = o.invoiceType as IncomeInvoiceType;
    if (o.description) inv.description = o.description as string;
    if (o.projectName) inv.projectName = o.projectName as string;
    if (o.companyName) inv.companyName = o.companyName as string;
    if (o.pdfPath) inv.pdfPath = o.pdfPath as string;
    if (o.emailedAt) inv.emailedAt = o.emailedAt as Date;
    if (client && typeof client === 'object') {
      inv.clientName = (client.companyName as string) || (client.name as string) || undefined;
    }
    return inv;
  }
}
