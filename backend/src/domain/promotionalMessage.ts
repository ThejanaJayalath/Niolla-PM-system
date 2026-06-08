import type { DiscountType } from './campaignDiscount';
import type { FestivalCampaignWithMeta } from './entities/FestivalCampaign';

function formatEndDate(endDate: Date | string): string {
  const d = endDate instanceof Date ? endDate : new Date(endDate);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDiscountOffer(discountType: DiscountType, discountValue: number): string {
  if (discountType === 'flat') {
    return `LKR ${Math.round(discountValue).toLocaleString()} off`;
  }
  return `${discountValue}% off`;
}

export function productScopeLabel(campaign: FestivalCampaignWithMeta): string {
  if (campaign.productScope === 'all') return 'all NIOLLA products';
  const codes = campaign.products?.map((p) => p.code) ?? [];
  if (codes.length === 1) return `NIOLLA ${codes[0]}`;
  if (codes.length > 1) return codes.map((c) => `NIOLLA ${c}`).join(', ');
  return 'selected NIOLLA products';
}

/** e.g. "Avurudu Special! Get 20% off on NIOLLA ERP. Valid till 14 April 2026!" */
export function buildPromotionalMessage(campaign: FestivalCampaignWithMeta): string {
  const offer = formatDiscountOffer(campaign.discountType, campaign.discountValue);
  const products = productScopeLabel(campaign);
  const until = formatEndDate(campaign.endDate);
  return `${campaign.name}! Get ${offer} on ${products}. Valid till ${until}!`;
}
