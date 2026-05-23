import mongoose from 'mongoose';
import { Customer } from '../../domain/entities/Customer';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { ProductModel } from '../../infrastructure/database/models/ProductModel';

export interface CreateCustomerInput {
  name: string;
  phoneNumber: string;
  email?: string;
  projects?: string[];
  inquiryId?: string;
  address?: string;
  businessType?: string;
  companyName?: string;
  nicNumber?: string;
  status?: 'active' | 'inactive';
  productId?: string;
  serviceCategories?: string[];
  dateOfBirth?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  phoneNumber?: string;
  email?: string;
  projects?: string[];
  address?: string;
  businessType?: string;
  companyName?: string;
  nicNumber?: string;
  status?: 'active' | 'inactive';
  productId?: string | null;
  serviceCategories?: string[];
  dateOfBirth?: string;
}

export interface CustomerListFilters {
  search?: string;
  productId?: string;
  /** Legacy filter by service category string */
  serviceCategory?: string;
}

export class CustomerService {
  private async getNextCustomerId(): Promise<string> {
    const last = await CustomerModel.findOne().sort({ customerId: -1 }).select('customerId').lean();
    if (!last?.customerId) return 'CID_001';
    const match = last.customerId.match(/^CID_(\d+)$/);
    const num = match ? parseInt(match[1], 10) + 1 : 1;
    return `CID_${String(num).padStart(3, '0')}`;
  }

  private async resolveProductLink(productId?: string): Promise<{
    productObjectId?: mongoose.Types.ObjectId;
    serviceCategories: string[];
    productName?: string;
    productCode?: string;
  }> {
    if (!productId?.trim() || !mongoose.Types.ObjectId.isValid(productId)) {
      return { serviceCategories: [] };
    }
    const product = await ProductModel.findById(productId).select('code name status').lean();
    if (!product) {
      throw new Error('Selected product not found');
    }
    if (product.status === 'inactive') {
      throw new Error('Selected product is inactive');
    }
    return {
      productObjectId: new mongoose.Types.ObjectId(productId),
      serviceCategories: [product.code],
      productName: product.name,
      productCode: product.code,
    };
  }

  async create(data: CreateCustomerInput): Promise<Customer> {
    const customerId = await this.getNextCustomerId();
    const link = await this.resolveProductLink(data.productId);
    const doc = await CustomerModel.create({
      customerId,
      name: data.name,
      phoneNumber: this.normalizePhone(data.phoneNumber),
      email: data.email?.trim() || undefined,
      projects: Array.isArray(data.projects) ? data.projects : [],
      inquiryId: data.inquiryId || undefined,
      address: data.address?.trim() || undefined,
      businessType: data.businessType?.trim() || undefined,
      companyName: data.companyName?.trim() || undefined,
      nicNumber: data.nicNumber?.trim() || undefined,
      status: data.status || 'active',
      productId: link.productObjectId,
      serviceCategories: link.productObjectId
        ? link.serviceCategories
        : Array.isArray(data.serviceCategories)
          ? data.serviceCategories
          : [],
      dateOfBirth: data.dateOfBirth?.trim() || undefined,
    });
    return this.toCustomer(doc);
  }

  async findById(id: string): Promise<Customer | null> {
    const doc = await CustomerModel.findById(id).populate('productId', 'name code');
    return doc ? this.toCustomer(doc) : null;
  }

  async findByInquiryId(inquiryId: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ inquiryId }).populate('productId', 'name code');
    return doc ? this.toCustomer(doc) : null;
  }

  async findAll(filters?: CustomerListFilters): Promise<Customer[]> {
    const query: Record<string, unknown> = {};
    if (filters?.search?.trim()) {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { phoneNumber: searchRegex },
        { email: searchRegex },
        { customerId: searchRegex },
        { companyName: searchRegex },
        { nicNumber: searchRegex },
      ];
    }
    if (filters?.productId?.trim() && mongoose.Types.ObjectId.isValid(filters.productId)) {
      query.productId = new mongoose.Types.ObjectId(filters.productId);
    } else {
      const cat = filters?.serviceCategory?.trim();
      if (cat) {
        query.serviceCategories = cat;
      }
    }
    const docs = await CustomerModel.find(query)
      .populate('productId', 'name code')
      .sort({ createdAt: -1 });
    return docs.map((d) => this.toCustomer(d));
  }

  async update(id: string, data: UpdateCustomerInput): Promise<Customer | null> {
    const update: Record<string, unknown> = { ...data };
    if (data.phoneNumber !== undefined) update.phoneNumber = this.normalizePhone(data.phoneNumber);
    if (data.projects !== undefined) update.projects = Array.isArray(data.projects) ? data.projects : [];
    if (data.address !== undefined) update.address = data.address?.trim() || undefined;
    if (data.businessType !== undefined) update.businessType = data.businessType?.trim() || undefined;
    if (data.companyName !== undefined) update.companyName = data.companyName?.trim() || undefined;
    if (data.nicNumber !== undefined) update.nicNumber = data.nicNumber?.trim() || undefined;
    if (data.dateOfBirth !== undefined) update.dateOfBirth = data.dateOfBirth?.trim() || undefined;

    if (data.productId !== undefined) {
      if (data.productId === null || data.productId === '') {
        update.productId = null;
        if (data.serviceCategories === undefined) {
          update.serviceCategories = [];
        }
      } else {
        const link = await this.resolveProductLink(data.productId);
        update.productId = link.productObjectId;
        if (data.serviceCategories === undefined) {
          update.serviceCategories = link.serviceCategories;
        }
      }
    } else if (data.serviceCategories !== undefined) {
      update.serviceCategories = Array.isArray(data.serviceCategories) ? data.serviceCategories : [];
    }

    delete update.productName;
    delete update.productCode;

    const doc = await CustomerModel.findByIdAndUpdate(id, update, { new: true }).populate(
      'productId',
      'name code'
    );
    return doc ? this.toCustomer(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await CustomerModel.findByIdAndDelete(id);
    return !!result;
  }

  private toCustomer(doc: { toObject: () => Record<string, unknown> }): Customer {
    const o = doc.toObject();
    const populated = o.productId as
      | { _id?: { toString: () => string }; name?: string; code?: string }
      | { toString: () => string }
      | null
      | undefined;

    let productId: string | undefined;
    let productName: string | undefined;
    let productCode: string | undefined;

    if (populated && typeof populated === 'object' && 'name' in populated && populated.name) {
      productId = populated._id?.toString?.() ?? undefined;
      productName = populated.name;
      productCode = populated.code;
    } else if (populated) {
      productId =
        typeof (populated as { toString?: () => string }).toString === 'function'
          ? (populated as { toString: () => string }).toString()
          : undefined;
    }

    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      customerId: o.customerId as string,
      name: o.name as string,
      phoneNumber: o.phoneNumber as string,
      email: o.email as string | undefined,
      projects: (o.projects as string[]) || [],
      inquiryId: o.inquiryId ? (o.inquiryId as { toString: () => string }).toString() : undefined,
      address: o.address as string | undefined,
      businessType: o.businessType as string | undefined,
      companyName: o.companyName as string | undefined,
      nicNumber: o.nicNumber as string | undefined,
      status: o.status as 'active' | 'inactive' | undefined,
      productId,
      productName,
      productCode,
      serviceCategories: (o.serviceCategories as string[]) || [],
      dateOfBirth: o.dateOfBirth as string | undefined,
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').trim() || phone.trim();
  }
}
