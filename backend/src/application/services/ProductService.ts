import { Product } from '../../domain/entities/Product';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { ProductModel } from '../../infrastructure/database/models/ProductModel';

export interface CreateProductInput {
  name: string;
  code: string;
  description?: string;
  basePricing: number;
  features?: string[];
  status?: 'active' | 'inactive';
}

export interface UpdateProductInput {
  name?: string;
  code?: string;
  description?: string;
  basePricing?: number;
  features?: string[];
  status?: 'active' | 'inactive';
}

export interface ProductWithStats extends Product {
  customerCount: number;
}

const DEFAULT_PRODUCTS: Omit<CreateProductInput, 'status'>[] = [
  {
    name: 'NIOLLA POS',
    code: 'POS',
    description: 'Point-of-sale system for retail and hospitality.',
    basePricing: 150000,
    features: ['Sales billing', 'Inventory', 'Receipt printing', 'Daily reports'],
  },
  {
    name: 'NIOLLA ERP',
    code: 'ERP',
    description: 'Enterprise resource planning for finance, HR, and operations.',
    basePricing: 500000,
    features: ['Finance & accounting', 'HR & payroll', 'Supply chain', 'Multi-branch'],
  },
  {
    name: 'NIOLLA CRM',
    code: 'CRM',
    description: 'Customer relationship management for leads and follow-ups.',
    basePricing: 200000,
    features: ['Lead pipeline', 'Contact history', 'Reminders', 'Team assignments'],
  },
];

export class ProductService {
  private async getNextProductId(): Promise<string> {
    const last = await ProductModel.findOne().sort({ productId: -1 }).select('productId').lean();
    if (!last?.productId) return 'PRD_001';
    const match = last.productId.match(/^PRD_(\d+)$/);
    const num = match ? parseInt(match[1], 10) + 1 : 1;
    return `PRD_${String(num).padStart(3, '0')}`;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '_');
  }

  async ensureDefaults(): Promise<void> {
    const count = await ProductModel.countDocuments();
    if (count > 0) return;
    for (const item of DEFAULT_PRODUCTS) {
      await this.create(item);
    }
  }

  async create(data: CreateProductInput): Promise<Product> {
    const code = this.normalizeCode(data.code);
    const existing = await ProductModel.findOne({ code });
    if (existing) {
      throw new Error(`Product code "${code}" already exists`);
    }
    const productId = await this.getNextProductId();
    const doc = await ProductModel.create({
      productId,
      name: data.name.trim(),
      code,
      description: data.description?.trim() || undefined,
      basePricing: Math.max(0, Number(data.basePricing) || 0),
      features: Array.isArray(data.features) ? data.features.map((f) => f.trim()).filter(Boolean) : [],
      status: data.status || 'active',
    });
    return this.toProduct(doc);
  }

  async findById(id: string): Promise<Product | null> {
    const doc = await ProductModel.findById(id);
    return doc ? this.toProduct(doc) : null;
  }

  async findAllWithStats(): Promise<ProductWithStats[]> {
    await this.ensureDefaults();
    const docs = await ProductModel.find().sort({ name: 1 });
    const counts = await CustomerModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { productId: { $ne: null } } },
      { $group: { _id: '$productId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>();
    for (const row of counts) {
      if (row._id) countMap.set(String(row._id), row.count);
    }
    return docs.map((d) => {
      const p = this.toProduct(d);
      return { ...p, customerCount: countMap.get(p._id || '') ?? 0 };
    });
  }

  async findAllActive(): Promise<Product[]> {
    await this.ensureDefaults();
    const docs = await ProductModel.find({ status: 'active' }).sort({ name: 1 });
    return docs.map((d) => this.toProduct(d));
  }

  async update(id: string, data: UpdateProductInput): Promise<Product | null> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.code !== undefined) {
      const code = this.normalizeCode(data.code);
      const clash = await ProductModel.findOne({ code, _id: { $ne: id } });
      if (clash) throw new Error(`Product code "${code}" already exists`);
      update.code = code;
    }
    if (data.description !== undefined) update.description = data.description?.trim() || undefined;
    if (data.basePricing !== undefined) update.basePricing = Math.max(0, Number(data.basePricing) || 0);
    if (data.features !== undefined) {
      update.features = Array.isArray(data.features) ? data.features.map((f) => f.trim()).filter(Boolean) : [];
    }
    if (data.status !== undefined) update.status = data.status;
    const doc = await ProductModel.findByIdAndUpdate(id, update, { new: true });
    return doc ? this.toProduct(doc) : null;
  }

  async delete(id: string): Promise<{ deleted: boolean; reason?: string }> {
    const linked = await CustomerModel.countDocuments({ productId: id });
    if (linked > 0) {
      return { deleted: false, reason: `Cannot delete: ${linked} customer(s) are linked to this product` };
    }
    const result = await ProductModel.findByIdAndDelete(id);
    return { deleted: !!result };
  }

  private toProduct(doc: { toObject: () => Record<string, unknown> }): Product {
    const o = doc.toObject();
    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      productId: o.productId as string,
      name: o.name as string,
      code: o.code as string,
      description: o.description as string | undefined,
      basePricing: o.basePricing as number,
      features: (o.features as string[]) || [],
      status: o.status as 'active' | 'inactive',
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
  }
}
