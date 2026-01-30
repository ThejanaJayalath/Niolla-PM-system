import { Inquiry, InquiryStatus } from '../../domain/entities/Inquiry';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';

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
  async create(data: CreateInquiryInput): Promise<{ inquiry: Inquiry; duplicatePhone: boolean }> {
    const normalizedPhone = this.normalizePhone(data.phoneNumber);
    const existing = await InquiryModel.findOne({ phoneNumber: normalizedPhone });
    const duplicatePhone = !!existing;

    const inquiry = await InquiryModel.create({
      ...data,
      phoneNumber: normalizedPhone,
      status: 'new' as InquiryStatus,
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

  async findAll(filters?: { status?: InquiryStatus }): Promise<Inquiry[]> {
    const query = filters?.status ? { status: filters.status } : {};
    const docs = await InquiryModel.find(query).sort({ createdAt: -1 });
    return docs.map((d) => d.toObject() as unknown as Inquiry);
  }

  async update(id: string, data: UpdateInquiryInput): Promise<Inquiry | null> {
    const update: Record<string, unknown> = { ...data };
    if (data.phoneNumber) update.phoneNumber = this.normalizePhone(data.phoneNumber);
    const doc = await InquiryModel.findByIdAndUpdate(id, update, { new: true });
    return doc ? (doc.toObject() as unknown as Inquiry) : null;
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
