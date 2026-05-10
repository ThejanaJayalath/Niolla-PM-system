import { Invoice } from '../../domain/entities/Invoice';
import type { IncomeInvoiceType } from '../../domain/incomeInvoiceType';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { InstallmentModel } from '../../infrastructure/database/models/InstallmentModel';
import mongoose from 'mongoose';

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

export class InvoiceService {
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
    if (latest && latest.status !== 'paid') {
      latest.proposalId = args.proposalId as unknown as typeof latest.proposalId;
      latest.clientId = args.clientId as unknown as typeof latest.clientId;
      latest.totalAmount = amount;
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
      status: 'pending',
      sourceType: 'PROPOSAL_ADVANCE',
      invoiceType: 'ADVANCE_PAYMENT',
      description: `Advance Payment (40%) for ${args.projectLabel}`,
      projectName: args.projectName,
      companyName: args.companyName,
    });
  }

  async create(data: CreateInvoiceInput): Promise<Invoice> {
    const doc = await InvoiceModel.create({
      transactionId: data.transactionId,
      inquiryId: data.inquiryId,
      proposalId: data.proposalId,
      clientId: data.clientId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate instanceof Date ? data.invoiceDate : new Date(data.invoiceDate),
      totalAmount: Number(data.totalAmount),
      taxAmount: data.taxAmount !== undefined ? Number(data.taxAmount) : undefined,
      discountAmt: data.discountAmt !== undefined ? Number(data.discountAmt) : undefined,
      status: data.status || 'paid',
      sourceType: data.sourceType || 'PAYMENT',
      invoiceType: data.invoiceType,
      description: data.description,
      projectName: data.projectName,
      companyName: data.companyName,
    });
    return this.toInvoice(doc);
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
    const invoice = await this.create({
      transactionId,
      clientId,
      invoiceNumber,
      invoiceDate: new Date(tx.paymentDate as Date),
      totalAmount: Number(tx.amount),
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
    return { invoice: doc ? this.toInvoice(doc) : null, previousStatus };
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
    if (o.discountAmt !== undefined) inv.discountAmt = Number(o.discountAmt);
    if (o.proposalId) {
      inv.proposalId =
        typeof o.proposalId === 'object' && o.proposalId !== null && 'toString' in o.proposalId
          ? (o.proposalId as { toString: () => string }).toString()
          : String(o.proposalId);
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
