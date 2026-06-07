import mongoose, { Schema, Document } from 'mongoose';
import { CampaignProductScope, CampaignStatus } from '../../../domain/entities/FestivalCampaign';

export interface FestivalCampaignDocument extends Document {
  campaignId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  discountType: 'percent' | 'flat';
  discountValue: number;
  discountPercent?: number;
  productScope: CampaignProductScope;
  productIds: mongoose.Types.ObjectId[];
  status: CampaignStatus;
  promotionalMessage?: string;
  promotionalBlastAt?: Date;
  promotionalBlastChannel?: 'email' | 'sms';
  promotionalBlastStats?: { sent: number; manual: number; failed: number; skipped: number };
  createdAt: Date;
  updatedAt: Date;
}

const festivalCampaignSchema = new Schema<FestivalCampaignDocument>(
  {
    campaignId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    discountType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    discountValue: { type: Number, min: 0 },
    discountPercent: { type: Number, min: 0, max: 100 },
    productScope: { type: String, enum: ['all', 'specific'], required: true, default: 'all' },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    promotionalMessage: { type: String, trim: true },
    promotionalBlastAt: { type: Date },
    promotionalBlastChannel: { type: String, enum: ['email', 'sms'] },
    promotionalBlastStats: {
      type: {
        sent: Number,
        manual: Number,
        failed: Number,
        skipped: Number,
      },
      _id: false,
    },
  },
  { timestamps: true }
);

festivalCampaignSchema.index({ status: 1, startDate: 1, endDate: 1 });

/** Campaigns table — time-bound product discounts (MongoDB `festivalcampaigns`). */
export const FestivalCampaignModel = mongoose.model<FestivalCampaignDocument>(
  'FestivalCampaign',
  festivalCampaignSchema
);

/** Alias used by discount routes (same collection as FestivalCampaign). */
export const DiscountModel = FestivalCampaignModel;
