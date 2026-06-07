import mongoose from 'mongoose';
import {
  computeDiscountAmount,
  computePriceBreakdown,
  DiscountType,
  normalizeDiscountType,
  PriceBreakdown,
} from '../../domain/campaignDiscount';
import {
  CampaignPhase,
  FestivalCampaignWithMeta,
} from '../../domain/entities/FestivalCampaign';
import { FestivalCampaignModel } from '../../infrastructure/database/models/FestivalCampaignModel';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { ProductModel } from '../../infrastructure/database/models/ProductModel';
import { ProductService } from './ProductService';
import { buildPromotionalMessage } from '../../domain/promotionalMessage';
import { endOfCalendarDay, startOfCalendarDay } from '../../domain/campaignDates';

export interface CreateCampaignInput {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  discountType?: DiscountType;
  discountValue?: number;
  /** @deprecated Use discountType + discountValue */
  discountPercent?: number;
  productScope: 'all' | 'specific';
  productIds?: string[];
  status?: 'active' | 'inactive';
  /** Send promotional blast to open prospects after create. */
  sendPromotionalBlast?: boolean;
  promotionalChannel?: 'email' | 'sms';
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  discountType?: DiscountType;
  discountValue?: number;
  discountPercent?: number;
  productScope?: 'all' | 'specific';
  productIds?: string[];
  status?: 'active' | 'inactive';
}

export function computeCampaignPhase(startDate: Date, endDate: Date, now = new Date()): CampaignPhase {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  if (now < start) return 'scheduled';
  if (now > end) return 'ended';
  return 'running';
}

export class CampaignService {
  private productService = new ProductService();

  /** Disable campaigns whose end date has passed (auto-expiry). */
  async expireEndedCampaigns(): Promise<number> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const result = await FestivalCampaignModel.updateMany(
      { status: 'active', endDate: { $lt: startOfToday } },
      { $set: { status: 'inactive' } }
    );
    return result.modifiedCount ?? 0;
  }

  private async ensureNotExpired(): Promise<void> {
    await this.expireEndedCampaigns();
  }

  private resolveDiscountInput(data: {
    discountType?: DiscountType;
    discountValue?: number;
    discountPercent?: number;
  }): { discountType: DiscountType; discountValue: number } {
    if (data.discountType === 'flat') {
      const flat = Number(data.discountValue);
      if (Number.isNaN(flat) || flat < 0) throw new Error('Flat discount must be a non-negative amount');
      return { discountType: 'flat', discountValue: flat };
    }
    const pct =
      data.discountValue !== undefined
        ? Number(data.discountValue)
        : Number(data.discountPercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      throw new Error('Percentage discount must be between 0 and 100');
    }
    return { discountType: 'percent', discountValue: pct };
  }

  getCampaignDiscountFields(campaign: {
    discountType?: string;
    discountValue?: number;
    discountPercent?: number;
  }): { discountType: DiscountType; discountValue: number } {
    const discountType = normalizeDiscountType(campaign.discountType);
    if (discountType === 'flat') {
      return { discountType: 'flat', discountValue: Number(campaign.discountValue) || 0 };
    }
    const discountValue =
      campaign.discountValue !== undefined && campaign.discountValue !== null
        ? Number(campaign.discountValue)
        : Number(campaign.discountPercent) || 0;
    return { discountType: 'percent', discountValue };
  }

  applyCampaignToPrice(
    originalPrice: number,
    campaign: { discountType?: string; discountValue?: number; discountPercent?: number }
  ): PriceBreakdown {
    const { discountType, discountValue } = this.getCampaignDiscountFields(campaign);
    return computePriceBreakdown(originalPrice, discountType, discountValue);
  }

  private async getNextCampaignId(): Promise<string> {
    const last = await FestivalCampaignModel.findOne().sort({ campaignId: -1 }).select('campaignId').lean();
    if (!last?.campaignId) return 'CMP_001';
    const match = last.campaignId.match(/^CMP_(\d+)$/);
    const num = match ? parseInt(match[1], 10) + 1 : 1;
    return `CMP_${String(num).padStart(3, '0')}`;
  }

  private parseDateRange(startDate: string, endDate: string): { start: Date; end: Date } {
    const start = startOfCalendarDay(startDate);
    const end = endOfCalendarDay(endDate);
    if (end < start) {
      throw new Error('End date must be on or after start date');
    }
    return { start, end };
  }

  private async resolveProductIds(productScope: 'all' | 'specific', productIds?: string[]): Promise<mongoose.Types.ObjectId[]> {
    if (productScope === 'all') return [];
    const ids = (productIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (ids.length === 0) {
      throw new Error('Select at least one product for a specific-product campaign');
    }
    const found = await ProductModel.find({ _id: { $in: ids } }).select('_id').lean();
    if (found.length !== ids.length) {
      throw new Error('One or more selected products were not found');
    }
    return ids.map((id) => new mongoose.Types.ObjectId(id));
  }

  campaignAppliesToProduct(
    campaign: { productScope: string; productIds?: mongoose.Types.ObjectId[] | string[] },
    productId: string
  ): boolean {
    if (campaign.productScope === 'all') return true;
    const ids = campaign.productIds || [];
    return ids.some((id) => String(id) === productId);
  }

  async create(data: CreateCampaignInput): Promise<FestivalCampaignWithMeta> {
    const discount = this.resolveDiscountInput(data);
    const { start, end } = this.parseDateRange(data.startDate, data.endDate);
    const productObjectIds = await this.resolveProductIds(data.productScope, data.productIds);
    const campaignId = await this.getNextCampaignId();
    const withMeta = {
      campaignId,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      startDate: start,
      endDate: end,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      discountPercent: discount.discountType === 'percent' ? discount.discountValue : undefined,
      productScope: data.productScope,
      productIds: productObjectIds,
      status: data.status || 'active',
    };
    const doc = await FestivalCampaignModel.create(withMeta);
    const populated = await FestivalCampaignModel.findById(doc._id).populate('productIds', 'name code');
    const campaign = this.toCampaignWithMeta(populated ?? doc);
    const promoMsg = buildPromotionalMessage(campaign);
    await FestivalCampaignModel.findByIdAndUpdate(doc._id, { $set: { promotionalMessage: promoMsg } });
    campaign.promotionalMessage = promoMsg;
    return campaign;
  }

  async findAll(): Promise<FestivalCampaignWithMeta[]> {
    await this.ensureNotExpired();
    const docs = await FestivalCampaignModel.find().sort({ startDate: -1 }).populate('productIds', 'name code');
    return docs.map((d) => this.toCampaignWithMeta(d));
  }

  async findActiveApplicable(productId?: string): Promise<FestivalCampaignWithMeta[]> {
    await this.ensureNotExpired();
    const now = new Date();
    const docs = await FestivalCampaignModel.find({
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate('productIds', 'name code')
      .lean();

    return docs
      .filter((d) => !productId || this.campaignAppliesToProduct(d, productId))
      .map((d) => this.toCampaignWithMeta({ toObject: () => d as Record<string, unknown> }));
  }

  async findBestActiveCampaign(
    productId: string | undefined,
    originalAmount: number
  ): Promise<FestivalCampaignWithMeta | null> {
    const applicable = await this.findActiveApplicable(productId);
    let best: FestivalCampaignWithMeta | null = null;
    let bestSavings = 0;
    for (const c of applicable) {
      const { discountType, discountValue } = this.getCampaignDiscountFields(c);
      const savings = computeDiscountAmount(originalAmount, discountType, discountValue);
      if (savings > bestSavings) {
        bestSavings = savings;
        best = c;
      }
    }
    return best;
  }

  async findBestActiveForInquiry(inquiryId: string, originalAmount: number): Promise<FestivalCampaignWithMeta | null> {
    const inquiry = await InquiryModel.findById(inquiryId).select('businessModel').lean();
    const productId = await this.productService.resolveProductIdFromBusinessModel(inquiry?.businessModel);
    return this.findBestActiveCampaign(productId, originalAmount);
  }

  async previewPricing(args: {
    productId?: string;
    inquiryId?: string;
    originalAmount: number;
  }): Promise<{
    originalAmount: number;
    breakdown: PriceBreakdown | null;
    campaign: FestivalCampaignWithMeta | null;
  }> {
    const originalAmount = Math.max(0, Number(args.originalAmount) || 0);
    let productId = args.productId;
    if (!productId && args.inquiryId) {
      const inquiry = await InquiryModel.findById(args.inquiryId).select('businessModel').lean();
      productId = await this.productService.resolveProductIdFromBusinessModel(inquiry?.businessModel);
    }
    const campaign = await this.findBestActiveCampaign(productId, originalAmount);
    if (!campaign) {
      return { originalAmount, breakdown: null, campaign: null };
    }
    const breakdown = this.applyCampaignToPrice(originalAmount, campaign);
    return { originalAmount, breakdown, campaign };
  }

  async findActiveForProduct(productId: string): Promise<FestivalCampaignWithMeta[]> {
    return this.findActiveApplicable(productId);
  }

  async findById(id: string): Promise<FestivalCampaignWithMeta | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await FestivalCampaignModel.findById(id).populate('productIds', 'name code');
    return doc ? this.toCampaignWithMeta(doc) : null;
  }

  async update(id: string, data: UpdateCampaignInput): Promise<FestivalCampaignWithMeta | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const existing = await FestivalCampaignModel.findById(id);
    if (!existing) return null;

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.description !== undefined) update.description = data.description?.trim() || undefined;
    if (data.status !== undefined) update.status = data.status;

    if (
      data.discountType !== undefined ||
      data.discountValue !== undefined ||
      data.discountPercent !== undefined
    ) {
      const discount = this.resolveDiscountInput({
        discountType: data.discountType ?? (existing.discountType as DiscountType),
        discountValue: data.discountValue ?? existing.discountValue,
        discountPercent: data.discountPercent ?? existing.discountPercent,
      });
      update.discountType = discount.discountType;
      update.discountValue = discount.discountValue;
      update.discountPercent = discount.discountType === 'percent' ? discount.discountValue : undefined;
    }

    if (data.startDate !== undefined || data.endDate !== undefined) {
      const startStr = data.startDate ?? existing.startDate.toISOString().slice(0, 10);
      const endStr = data.endDate ?? existing.endDate.toISOString().slice(0, 10);
      const { start, end } = this.parseDateRange(startStr, endStr);
      update.startDate = start;
      update.endDate = end;
    }

    if (data.productScope !== undefined || data.productIds !== undefined) {
      const scope = data.productScope ?? existing.productScope;
      const productObjectIds = await this.resolveProductIds(
        scope,
        data.productIds ?? existing.productIds.map((p) => String(p))
      );
      update.productScope = scope;
      update.productIds = productObjectIds;
    }

    const doc = await FestivalCampaignModel.findByIdAndUpdate(id, update, { new: true }).populate(
      'productIds',
      'name code'
    );
    return doc ? this.toCampaignWithMeta(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await FestivalCampaignModel.findByIdAndDelete(id);
    return !!result;
  }

  private toCampaignWithMeta(doc: {
    toObject: () => Record<string, unknown>;
  }): FestivalCampaignWithMeta {
    const o = doc.toObject();
    const startDate = o.startDate as Date;
    const endDate = o.endDate as Date;
    const status = o.status as 'active' | 'inactive';
    const phase = computeCampaignPhase(startDate, endDate);
    const isLive = status === 'active' && phase === 'running';

    const { discountType, discountValue } = this.getCampaignDiscountFields({
      discountType: o.discountType as string | undefined,
      discountValue: o.discountValue as number | undefined,
      discountPercent: o.discountPercent as number | undefined,
    });

    const populated = o.productIds as
      | { _id?: { toString: () => string }; name?: string; code?: string }[]
      | mongoose.Types.ObjectId[]
      | undefined;

    let products: { _id: string; name: string; code: string }[] | undefined;
    let productIds: string[] | undefined;

    if (Array.isArray(populated) && populated.length > 0) {
      if (populated[0] && typeof populated[0] === 'object' && 'name' in (populated[0] as object)) {
        products = (populated as { _id?: { toString: () => string }; name: string; code: string }[]).map((p) => ({
          _id: p._id?.toString?.() ?? String(p._id),
          name: p.name,
          code: p.code,
        }));
        productIds = products.map((p) => p._id);
      } else {
        productIds = populated.map((id) => String(id));
      }
    } else if (Array.isArray(o.productIds)) {
      productIds = (o.productIds as mongoose.Types.ObjectId[]).map((id) => String(id));
    }

    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      campaignId: o.campaignId as string,
      name: o.name as string,
      description: o.description as string | undefined,
      startDate,
      endDate,
      discountType,
      discountValue,
      discountPercent: discountType === 'percent' ? discountValue : undefined,
      productScope: o.productScope as 'all' | 'specific',
      productIds,
      status,
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
      phase,
      isLive,
      promotionalMessage: o.promotionalMessage as string | undefined,
      promotionalBlastAt: o.promotionalBlastAt as Date | undefined,
      promotionalBlastChannel: o.promotionalBlastChannel as 'email' | 'sms' | undefined,
      promotionalBlastStats: o.promotionalBlastStats as
        | { sent: number; manual: number; failed: number; skipped: number }
        | undefined,
      products,
    };
  }
}
