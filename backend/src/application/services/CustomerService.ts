import { Customer } from '../../domain/entities/Customer';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';

export interface CreateCustomerInput {
  name: string;
  phoneNumber: string;
  email?: string;
  projects?: string[];
  inquiryId?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  phoneNumber?: string;
  email?: string;
  projects?: string[];
}

export class CustomerService {
  private async getNextCustomerId(): Promise<string> {
    const last = await CustomerModel.findOne().sort({ customerId: -1 }).select('customerId').lean();
    if (!last?.customerId) return 'CID_001';
    const match = last.customerId.match(/^CID_(\d+)$/);
    const num = match ? parseInt(match[1], 10) + 1 : 1;
    return `CID_${String(num).padStart(3, '0')}`;
  }

  async create(data: CreateCustomerInput): Promise<Customer> {
    const customerId = await this.getNextCustomerId();
    const doc = await CustomerModel.create({
      customerId,
      name: data.name,
      phoneNumber: this.normalizePhone(data.phoneNumber),
      email: data.email?.trim() || undefined,
      projects: Array.isArray(data.projects) ? data.projects : [],
      inquiryId: data.inquiryId || undefined,
    });
    return this.toCustomer(doc);
  }

  async findById(id: string): Promise<Customer | null> {
    const doc = await CustomerModel.findById(id);
    return doc ? this.toCustomer(doc) : null;
  }

  async findByInquiryId(inquiryId: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ inquiryId });
    return doc ? this.toCustomer(doc) : null;
  }

  async findAll(filters?: { search?: string }): Promise<Customer[]> {
    const query: Record<string, unknown> = {};
    if (filters?.search?.trim()) {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { phoneNumber: searchRegex },
        { email: searchRegex },
        { customerId: searchRegex },
      ];
    }
    const docs = await CustomerModel.find(query).sort({ createdAt: -1 });
    return docs.map((d) => this.toCustomer(d));
  }

  async update(id: string, data: UpdateCustomerInput): Promise<Customer | null> {
    const update: Record<string, unknown> = { ...data };
    if (data.phoneNumber !== undefined) update.phoneNumber = this.normalizePhone(data.phoneNumber);
    if (data.projects !== undefined) update.projects = Array.isArray(data.projects) ? data.projects : [];
    const doc = await CustomerModel.findByIdAndUpdate(id, update, { new: true });
    return doc ? this.toCustomer(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await CustomerModel.findByIdAndDelete(id);
    return !!result;
  }

  private toCustomer(doc: { toObject: () => Record<string, unknown> }): Customer {
    const o = doc.toObject();
    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      customerId: o.customerId as string,
      name: o.name as string,
      phoneNumber: o.phoneNumber as string,
      email: o.email as string | undefined,
      projects: (o.projects as string[]) || [],
      inquiryId: o.inquiryId ? (o.inquiryId as { toString: () => string }).toString() : undefined,
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').trim() || phone.trim();
  }
}
