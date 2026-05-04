import {
  CustomerRequirement,
  RequirementPriority,
  RequirementSource,
  RequirementStatus,
} from '../../domain/entities/CustomerRequirement';
import { CustomerRequirementModel } from '../../infrastructure/database/models/CustomerRequirementModel';

export interface CreateCustomerRequirementInput {
  customerRef: string;
  inquiryRef?: string;
  projectRef?: string;
  title: string;
  description?: string;
  priority?: RequirementPriority;
  status?: RequirementStatus;
  source?: RequirementSource;
  capturedAt?: Date;
  capturedBy?: string;
}

export interface UpdateCustomerRequirementInput {
  title?: string;
  description?: string;
  priority?: RequirementPriority;
  status?: RequirementStatus;
  source?: RequirementSource;
}

export class CustomerRequirementService {
  async create(data: CreateCustomerRequirementInput): Promise<CustomerRequirement> {
    const doc = await CustomerRequirementModel.create({
      ...data,
      priority: data.priority || 'MEDIUM',
      status: data.status || 'OPEN',
      source: data.source || 'MANUAL',
      capturedAt: data.capturedAt || new Date(),
    });
    return this.toRequirement(doc.toObject());
  }

  async findById(id: string): Promise<CustomerRequirement | null> {
    const doc = await CustomerRequirementModel.findById(id);
    return doc ? this.toRequirement(doc.toObject()) : null;
  }

  async findByCustomer(customerId: string): Promise<CustomerRequirement[]> {
    const docs = await CustomerRequirementModel.find({ customerRef: customerId }).sort({ capturedAt: -1, createdAt: -1 });
    return docs.map((doc) => this.toRequirement(doc.toObject()));
  }

  async update(id: string, data: UpdateCustomerRequirementInput): Promise<CustomerRequirement | null> {
    const doc = await CustomerRequirementModel.findByIdAndUpdate(
      id,
      { ...data, lastUpdatedAt: new Date() },
      { new: true }
    );
    return doc ? this.toRequirement(doc.toObject()) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await CustomerRequirementModel.findByIdAndDelete(id);
    return !!result;
  }

  private toRequirement(o: any): CustomerRequirement {
    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      customerRef: (o.customerRef as { toString: () => string })?.toString?.() || String(o.customerRef),
      inquiryRef: o.inquiryRef ? (o.inquiryRef as { toString: () => string })?.toString?.() : undefined,
      projectRef: o.projectRef ? (o.projectRef as { toString: () => string })?.toString?.() : undefined,
      title: o.title as string,
      description: o.description as string | undefined,
      priority: o.priority as RequirementPriority,
      status: o.status as RequirementStatus,
      source: o.source as RequirementSource,
      capturedAt: o.capturedAt as Date,
      capturedBy: o.capturedBy ? (o.capturedBy as { toString: () => string })?.toString?.() : undefined,
      lastUpdatedAt: o.lastUpdatedAt as Date | undefined,
      createdAt: o.createdAt as Date | undefined,
      updatedAt: o.updatedAt as Date | undefined,
    };
  }
}
