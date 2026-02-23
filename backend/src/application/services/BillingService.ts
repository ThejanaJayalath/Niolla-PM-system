import { Billing, BillingItem } from '../../domain/entities/Billing';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { BillingModel } from '../../infrastructure/database/models/BillingModel';

export interface CreateBillingInput {
  inquiryId?: string;
  customerName: string;
  projectName?: string;
  phoneNumber?: string;
  items: BillingItem[];
  totalAmount: number;
  companyName?: string;
  address?: string;
  email?: string;
  billingDate: Date;
}

export class BillingService {
  async getNextBillingId(): Promise<string> {
    const last = await BillingModel.findOne().sort({ createdAt: -1 }).select('billingId').lean();
    let nextNum = 1;
    if (last?.billingId) {
      const match = last.billingId.match(/INV\s*(\d+)/i);
      if (match?.[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `INV ${nextNum.toString().padStart(3, '0')}`;
  }

  async create(data: CreateBillingInput): Promise<Billing> {
    const billingId = await this.getNextBillingId();
    const doc = await BillingModel.create({
      billingId,
      inquiryId: data.inquiryId,
      customerName: data.customerName,
      projectName: data.projectName,
      phoneNumber: data.phoneNumber,
      items: data.items,
      totalAmount: data.totalAmount,
      companyName: data.companyName,
      address: data.address,
      email: data.email,
      billingDate: data.billingDate,
    });
    return doc.toObject() as unknown as Billing;
  }

  async findById(id: string): Promise<Billing | null> {
    const doc = await BillingModel.findById(id).populate('inquiryId', 'customerName phoneNumber');
    return doc ? (doc.toObject() as unknown as Billing) : null;
  }

  async findAll(): Promise<Billing[]> {
    const docs = await BillingModel.find().sort({ createdAt: -1 }).populate('inquiryId', 'customerName phoneNumber');
    return docs.map((d) => d.toObject() as unknown as Billing);
  }

  async delete(id: string): Promise<boolean> {
    const result = await BillingModel.findByIdAndDelete(id);
    return !!result;
  }
}
