import mongoose from 'mongoose';
import { Billing, BillingItem, BillingType } from '../../domain/entities/Billing';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { BillingModel } from '../../infrastructure/database/models/BillingModel';

export interface CreateBillingInput {
  inquiryId?: string;
  customerName: string;
  projectName?: string;
  phoneNumber?: string;
  items: BillingItem[];
  subTotal: number;
  advanceApplied: number;
  totalAmount: number;
  billingType: BillingType;
  companyName?: string;
  address?: string;
  email?: string;
  billingDate: Date;
}

export interface UpdateBillingInput {
  companyName?: string;
  address?: string;
  email?: string;
  billingDate?: Date;
  items?: BillingItem[];
  subTotal?: number;
  advanceApplied?: number;
  totalAmount?: number;
  billingType?: BillingType;
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
      subTotal: data.subTotal,
      advanceApplied: data.advanceApplied ?? 0,
      totalAmount: data.totalAmount,
      billingType: data.billingType ?? 'NORMAL',
      companyName: data.companyName,
      address: data.address,
      email: data.email,
      billingDate: data.billingDate,
    });
    const billing = doc.toObject() as unknown as Billing;
    if (data.inquiryId) {
      if (billing.billingType === 'ADVANCE') {
        await InquiryModel.findByIdAndUpdate(data.inquiryId, {
          $inc: { totalAdvancePaid: data.totalAmount },
        });
      }
      if ((data.advanceApplied ?? 0) > 0) {
        await InquiryModel.findByIdAndUpdate(data.inquiryId, {
          $inc: { totalAdvanceUsed: data.advanceApplied },
        });
      }
    }
    return billing;
  }

  async findById(id: string): Promise<Billing | null> {
    const doc = await BillingModel.findById(id).populate('inquiryId', 'customerName phoneNumber customerId');
    return doc ? (doc.toObject() as unknown as Billing) : null;
  }

  async findAll(): Promise<Billing[]> {
    const docs = await BillingModel.find().sort({ createdAt: -1 }).populate('inquiryId', 'customerName phoneNumber customerId');
    return docs.map((d) => d.toObject() as unknown as Billing);
  }

  async delete(id: string): Promise<boolean> {
    const doc = await BillingModel.findById(id).lean();
    if (!doc) return false;
    if (doc.inquiryId) {
      if (doc.billingType === 'ADVANCE') {
        await InquiryModel.findByIdAndUpdate(doc.inquiryId, { $inc: { totalAdvancePaid: -doc.totalAmount } });
      }
      if ((doc.advanceApplied ?? 0) > 0) {
        await InquiryModel.findByIdAndUpdate(doc.inquiryId, { $inc: { totalAdvanceUsed: -doc.advanceApplied } });
      }
    }
    const result = await BillingModel.findByIdAndDelete(id);
    return !!result;
  }

  async update(id: string, data: UpdateBillingInput): Promise<Billing | null> {
    const old = await BillingModel.findById(id).lean();
    if (!old) return null;

    const updatePayload: Record<string, unknown> = { ...data };
    if (data.billingDate !== undefined) updatePayload.billingDate = new Date(data.billingDate);

    const doc = await BillingModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true });
    if (!doc) return null;

    const inquiryId = doc.inquiryId ? new mongoose.Types.ObjectId(doc.inquiryId.toString()) : null;
    if (inquiryId) {
      const oldAdvanceApplied = old.advanceApplied ?? 0;
      const newAdvanceApplied = doc.advanceApplied ?? 0;
      const deltaApplied = newAdvanceApplied - oldAdvanceApplied;
      if (deltaApplied !== 0) {
        await InquiryModel.findByIdAndUpdate(inquiryId, { $inc: { totalAdvanceUsed: deltaApplied } });
      }
      if (old.billingType === 'ADVANCE' && doc.billingType !== 'ADVANCE') {
        await InquiryModel.findByIdAndUpdate(inquiryId, { $inc: { totalAdvancePaid: -old.totalAmount } });
      } else if (old.billingType !== 'ADVANCE' && doc.billingType === 'ADVANCE') {
        await InquiryModel.findByIdAndUpdate(inquiryId, { $inc: { totalAdvancePaid: doc.totalAmount } });
      } else if (doc.billingType === 'ADVANCE' && old.totalAmount !== doc.totalAmount) {
        await InquiryModel.findByIdAndUpdate(inquiryId, {
          $inc: { totalAdvancePaid: doc.totalAmount - old.totalAmount },
        });
      }
    }

    await doc.populate('inquiryId', 'customerName phoneNumber customerId');
    return doc.toObject() as unknown as Billing;
  }

  /** Remaining advance for an inquiry (totalAdvancePaid - totalAdvanceUsed). Used when creating NORMAL/FINAL bills. */
  async getRemainingAdvance(inquiryId: string): Promise<number> {
    const inquiry = await InquiryModel.findById(inquiryId).select('totalAdvancePaid totalAdvanceUsed').lean();
    if (!inquiry) return 0;
    const paid = Number(inquiry.totalAdvancePaid ?? 0);
    const used = Number(inquiry.totalAdvanceUsed ?? 0);
    return Math.max(0, paid - used);
  }
}
