import mongoose from 'mongoose';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { ProductModel } from '../../infrastructure/database/models/ProductModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { ProductService } from './ProductService';

export interface ProductSalesRow {
  productId: string;
  productCode: string;
  productName: string;
  /** Licenses / setups sold — customers linked to this product */
  salesVolume: number;
  /** Sum of project contract values for customers on this product */
  contractValue: number;
  /** Cash collected from payment transactions for those customers */
  revenueCollected: number;
}

export interface ProductSalesHighlight {
  productId: string;
  productCode: string;
  productName: string;
  salesVolume: number;
  revenueCollected: number;
}

export interface ProductSalesAnalytics {
  products: ProductSalesRow[];
  topByQuantity: ProductSalesHighlight | null;
  topByRevenue: ProductSalesHighlight | null;
  totals: {
    salesVolume: number;
    revenueCollected: number;
    contractValue: number;
  };
}

export class ProductSalesService {
  private productService = new ProductService();

  async getAnalytics(): Promise<ProductSalesAnalytics> {
    await this.productService.ensureDefaults();

    const [volumeRows, contractRows, revenueRows] = await Promise.all([
      CustomerModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { productId: { $ne: null } } },
        { $group: { _id: '$productId', count: { $sum: 1 } } },
      ]),
      ProjectModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
        {
          $lookup: {
            from: 'customers',
            localField: 'clientId',
            foreignField: '_id',
            as: 'client',
          },
        },
        { $unwind: '$client' },
        { $match: { 'client.productId': { $ne: null } } },
        { $group: { _id: '$client.productId', total: { $sum: '$totalValue' } } },
      ]),
      PaymentTransactionModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
        {
          $lookup: {
            from: 'customers',
            localField: 'clientId',
            foreignField: '_id',
            as: 'client',
          },
        },
        { $unwind: '$client' },
        { $match: { 'client.productId': { $ne: null } } },
        { $group: { _id: '$client.productId', total: { $sum: '$amount' } } },
      ]),
    ]);

    const volumeMap = new Map<string, number>();
    for (const row of volumeRows) {
      if (row._id) volumeMap.set(String(row._id), row.count);
    }
    const contractMap = new Map<string, number>();
    for (const row of contractRows) {
      if (row._id) contractMap.set(String(row._id), row.total);
    }
    const revenueMap = new Map<string, number>();
    for (const row of revenueRows) {
      if (row._id) revenueMap.set(String(row._id), row.total);
    }

    const productDocs = await ProductModel.find().sort({ name: 1 }).lean();
    const products: ProductSalesRow[] = productDocs.map((p) => {
      const id = String(p._id);
      return {
        productId: id,
        productCode: p.code,
        productName: p.name,
        salesVolume: volumeMap.get(id) ?? 0,
        contractValue: contractMap.get(id) ?? 0,
        revenueCollected: revenueMap.get(id) ?? 0,
      };
    });

    const withVolume = products.filter((p) => p.salesVolume > 0);
    const withRevenue = products.filter((p) => p.revenueCollected > 0);

    const topByQuantity =
      withVolume.length > 0
        ? withVolume.reduce((best, row) => (row.salesVolume > best.salesVolume ? row : best))
        : null;

    const topByRevenue =
      withRevenue.length > 0
        ? withRevenue.reduce((best, row) => (row.revenueCollected > best.revenueCollected ? row : best))
        : null;

    const toHighlight = (row: ProductSalesRow): ProductSalesHighlight => ({
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      salesVolume: row.salesVolume,
      revenueCollected: row.revenueCollected,
    });

    return {
      products,
      topByQuantity: topByQuantity ? toHighlight(topByQuantity) : null,
      topByRevenue: topByRevenue ? toHighlight(topByRevenue) : null,
      totals: {
        salesVolume: products.reduce((s, p) => s + p.salesVolume, 0),
        revenueCollected: products.reduce((s, p) => s + p.revenueCollected, 0),
        contractValue: products.reduce((s, p) => s + p.contractValue, 0),
      },
    };
  }
}
