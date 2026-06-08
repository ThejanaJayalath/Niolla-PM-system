export type DiscountType = 'percent' | 'flat';

export interface PriceBreakdown {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  discountLabel: string;
}

export function normalizeDiscountType(raw?: string): DiscountType {
  return raw === 'flat' ? 'flat' : 'percent';
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

/** Given final payable, infer gross and discount for accounting line items. */
export function deriveDiscountLinesFromFinalPayable(
  finalPayable: number,
  discountType: DiscountType,
  discountValue: number
): { originalPrice: number; discountAmount: number } | null {
  if (finalPayable <= 0 || discountValue <= 0) return null;
  if (discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, discountValue));
    if (pct >= 100) return null;
    const originalPrice = Math.round((finalPayable / (1 - pct / 100)) * 100) / 100;
    const discountAmount = Math.round((originalPrice - finalPayable) * 100) / 100;
    return { originalPrice, discountAmount };
  }
  const flat = Math.round(discountValue * 100) / 100;
  const originalPrice = Math.round((finalPayable + flat) * 100) / 100;
  const discountAmount = Math.min(flat, Math.round((originalPrice - finalPayable) * 100) / 100);
  return { originalPrice, discountAmount };
}

export function formatLkr(amount: number): string {
  return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
