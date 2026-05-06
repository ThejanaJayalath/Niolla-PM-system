import { Invoice } from '../../domain/entities/Invoice';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';

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
      : 1;
    return `${prefix}${year}${month}-${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Idempotent: one PROPOSAL_ADVANCE invoice per inquiry. Maps proposal advance to invoice totalAmount;
   * links clientId and companyName (shop) for reporting.
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
     * Use the same id as Billing `billingId` (e.g. INV 001) so finance records reconcile.
     * If omitted (e.g. proposal-only confirm), falls back to sequential INV-YYYYMM-####.
     */
    invoiceNumber?: string;
  }): Promise<Invoice | null> {
    const amount = Number(args.advanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (await this.hasProposalAdvanceInvoice(args.inquiryId)) {
      return this.findProposalAdvanceByInquiryId(args.inquiryId);
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
    return docs.map((d) => this.toInvoice(d));
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
    const inv: Invoice & { clientName?: string } = {
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
