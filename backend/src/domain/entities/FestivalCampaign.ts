import type { DiscountType } from '../campaignDiscount';

export type CampaignProductScope = 'all' | 'specific';
export type CampaignStatus = 'active' | 'inactive';
export type CampaignPhase = 'scheduled' | 'running' | 'ended';

export interface FestivalCampaign {
  _id?: string;
  campaignId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  discountType: DiscountType;
  discountValue: number;
  /** @deprecated Use discountType + discountValue */
  discountPercent?: number;
  productScope: CampaignProductScope;
  productIds?: string[];
  status: CampaignStatus;
  promotionalMessage?: string;
  promotionalBlastAt?: Date;
  promotionalBlastChannel?: 'email' | 'sms';
  promotionalBlastStats?: { sent: number; manual: number; failed: number; skipped: number };
  createdAt?: Date;
  updatedAt?: Date;
}

/** Alias: product-linked discount row (same as FestivalCampaign / Discount collection). */
export type ProductDiscount = FestivalCampaign;

export interface FestivalCampaignWithMeta extends FestivalCampaign {
  phase: CampaignPhase;
  isLive: boolean;
  products?: { _id: string; name: string; code: string }[];
}
