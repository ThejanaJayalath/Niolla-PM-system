import { Invoice } from '../../domain/entities/Invoice';
import { InvoiceModel } from '../../infrastructure/database/models/InvoiceModel';

export interface CreateInvoiceInput {
  transactionId: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  taxAmount?: number;
  discountAmt?: number;
  status?: 'draft' | 'sent' | 'paid';
}

export interface ListInvoicesFilters {
  clientId?: string;
  status?: string;
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

  async create(data: CreateInvoiceInput): Promise<Invoice> {
    const doc = await InvoiceModel.create({
      transactionId: data.transactionId,
      clientId: data.clientId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate instanceof Date ? data.invoiceDate : new Date(data.invoiceDate),
      totalAmount: Number(data.totalAmount),
      taxAmount: data.taxAmount !== undefined ? Number(data.taxAmount) : undefined,
      discountAmt: data.discountAmt !== undefined ? Number(data.discountAmt) : undefined,
      status: data.status || 'paid',
    });
    return this.toInvoice(doc);
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
    const docs = await InvoiceModel.find(query)
      .populate('clientId', 'name companyName email')
      .sort({ invoiceDate: -1 });
    return docs.map((d) => this.toInvoice(d));
  }

  private toInvoice(doc: { toObject: () => Record<string, unknown> }): Invoice {
    const o = doc.toObject();
    const client = o.clientId as { _id?: unknown; name?: string; companyName?: string } | null;
    const txId = o.transactionId as { _id?: unknown } | null;
    const inv: Invoice & { clientName?: string } = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      transactionId: txId && typeof txId === 'object' && txId._id
        ? (txId._id as { toString: () => string }).toString()
        : (o.transactionId as string),
      clientId: client && typeof client === 'object' && client._id
        ? (client._id as { toString: () => string }).toString()
        : (o.clientId as string),
      invoiceNumber: o.invoiceNumber as string,
      invoiceDate: o.invoiceDate as Date,
      totalAmount: Number(o.totalAmount),
      status: o.status as 'draft' | 'sent' | 'paid',
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
    if (o.taxAmount !== undefined) inv.taxAmount = Number(o.taxAmount);
    if (o.discountAmt !== undefined) inv.discountAmt = Number(o.discountAmt);
    if (o.pdfPath) inv.pdfPath = o.pdfPath as string;
    if (o.emailedAt) inv.emailedAt = o.emailedAt as Date;
    if (client && typeof client === 'object') {
      inv.clientName = (client.companyName as string) || (client.name as string) || undefined;
    }
    return inv;
  }
}
