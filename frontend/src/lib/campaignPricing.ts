export type DiscountType = 'percent' | 'flat';

export interface PriceBreakdown {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  discountLabel: string;
}

export function computeDiscountAmount(originalPrice: number, discountType: DiscountType, discountValue: number): number {
  if (originalPrice <= 0 || discountValue <= 0) return 0;
  if (discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, discountValue));
    return Math.round(originalPrice * (pct / 100) * 100) / 100;
  }
  return Math.min(originalPrice, Math.round(discountValue * 100) / 100);
}

export function computePriceBreakdown(
  originalPrice: number,
  discountType: DiscountType,
  discountValue: number
): PriceBreakdown {
  const discountAmount = computeDiscountAmount(originalPrice, discountType, discountValue);
  const finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);
  const discountLabel =
    discountType === 'percent'
      ? `${discountValue}% OFF`
      : `LKR ${Math.round(discountValue).toLocaleString('en-LK')} OFF`;
  return { originalPrice, discountAmount, finalPrice, discountLabel };
}

export function formatLkr(amount: number): string {
  return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface CampaignPricingMeta {
  _id: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  discountPercent?: number;
}

export function campaignDiscountFields(c: CampaignPricingMeta): { discountType: DiscountType; discountValue: number } {
  const discountType = c.discountType ?? 'percent';
  const discountValue =
    discountType === 'percent'
      ? (c.discountValue ?? c.discountPercent ?? 0)
      : (c.discountValue ?? 0);
  return { discountType, discountValue };
}
