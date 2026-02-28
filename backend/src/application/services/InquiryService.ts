import { Inquiry, InquiryStatus } from '../../domain/entities/Inquiry';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { CustomerService } from './CustomerService';

export interface CreateInquiryInput {
  customerName: string;
  phoneNumber: string;
  projectDescription: string;
  requiredFeatures: string[];
  internalNotes?: string;
  createdBy?: string;
}

export interface UpdateInquiryInput {
  customerName?: string;
  phoneNumber?: string;
  projectDescription?: string;
  requiredFeatures?: string[];
  internalNotes?: string;
  status?: InquiryStatus;
}

export class InquiryService {
  private customerService = new CustomerService();

  async create(data: CreateInquiryInput): Promise<{ inquiry: Inquiry; duplicatePhone: boolean }> {
    const normalizedPhone = this.normalizePhone(data.phoneNumber);
    const existing = await InquiryModel.findOne({ phoneNumber: normalizedPhone });
    const duplicatePhone = !!existing;

    const inquiry = await InquiryModel.create({
      ...data,
      phoneNumber: normalizedPhone,
      status: 'NEW' as InquiryStatus,
      createdBy: data.createdBy,
    });

    return {
      inquiry: inquiry.toObject() as unknown as Inquiry,
      duplicatePhone,
    };
  }

  async findById(id: string): Promise<Inquiry | null> {
    const doc = await InquiryModel.findById(id);
    return doc ? (doc.toObject() as unknown as Inquiry) : null;
  }

  async findAll(filters?: { status?: InquiryStatus; search?: string }): Promise<Inquiry[]> {
    const query: Record<string, unknown> = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.search) {
      const searchRegex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { customerName: searchRegex },
        { phoneNumber: searchRegex },
        { projectDescription: searchRegex }
      ];
    }

    const docs = await InquiryModel.find(query).sort({ createdAt: -1 });
    return docs.map((d) => d.toObject() as unknown as Inquiry);
  }

  async update(id: string, data: UpdateInquiryInput): Promise<Inquiry | null> {
    const update: Record<string, unknown> = { ...data };
    if (data.phoneNumber) update.phoneNumber = this.normalizePhone(data.phoneNumber);
    const doc = await InquiryModel.findByIdAndUpdate(id, update, { new: true, runValidators: false });
    const inquiry = doc ? (doc.toObject() as unknown as Inquiry) : null;
    if (inquiry && data.status === 'CONFIRMED') {
      const existing = await this.customerService.findByInquiryId(String(inquiry._id));
      if (!existing) {
        await this.customerService.create({
          name: inquiry.customerName,
          phoneNumber: inquiry.phoneNumber,
          projects: [inquiry.projectDescription].filter(Boolean),
          inquiryId: String(inquiry._id),
        });
      }
    }
    return inquiry;
  }

  async delete(id: string): Promise<boolean> {
    const result = await InquiryModel.findByIdAndDelete(id);
    return !!result;
  }

  async checkDuplicatePhone(phoneNumber: string, excludeId?: string): Promise<boolean> {
    const normalized = this.normalizePhone(phoneNumber);
    const query: { phoneNumber: string; _id?: { $ne: unknown } } = { phoneNumber: normalized };
    if (excludeId) query._id = { $ne: excludeId } as { $ne: unknown };
    const existing = await InquiryModel.findOne(query);
    return !!existing;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').trim() || phone.trim();
  }
}
