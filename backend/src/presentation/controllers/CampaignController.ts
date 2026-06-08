import { Response } from 'express';
import { CampaignService } from '../../application/services/CampaignService';
import { CampaignMarketingService } from '../../application/services/CampaignMarketingService';
import { ProductService } from '../../application/services/ProductService';
import { AuthenticatedRequest } from '../middleware/auth';

const campaignService = new CampaignService();
const campaignMarketingService = new CampaignMarketingService();
const productService = new ProductService();

export async function listCampaigns(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const campaigns = await campaignService.findAll();
  res.json({ success: true, data: campaigns });
}

export async function getCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
  const campaign = await campaignService.findById(req.params.id);
  if (!campaign) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return;
  }
  res.json({ success: true, data: campaign });
}

export async function getActiveCampaignsForProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { productId } = req.params;
  if (!productId) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'productId is required' } });
    return;
  }
  const product = await productService.findById(productId);
  const basePricing = product?.basePricing ?? 0;
  const preview = await campaignService.previewPricing({ productId, originalAmount: basePricing });
  res.json({
    success: true,
    data: {
      campaigns: preview.campaign ? [preview.campaign] : [],
      basePricing,
      discountedPrice: preview.breakdown?.finalPrice ?? basePricing,
      breakdown: preview.breakdown,
      bestCampaign: preview.campaign,
    },
  });
}

export async function previewCampaignPricing(req: AuthenticatedRequest, res: Response): Promise<void> {
  const productId = req.query.productId as string | undefined;
  const inquiryId = req.query.inquiryId as string | undefined;
  const originalAmount = Number(req.query.originalAmount);
  if (!Number.isFinite(originalAmount) || originalAmount < 0) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'originalAmount must be a non-negative number' },
    });
    return;
  }
  const preview = await campaignService.previewPricing({ productId, inquiryId, originalAmount });
  res.json({ success: true, data: preview });
}

export async function createCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const campaign = await campaignService.create(req.body);
    let promotionalBlast = null;
    if (req.body.sendPromotionalBlast === true) {
      const channel = req.body.promotionalChannel === 'email' ? 'email' : 'sms';
      promotionalBlast = await campaignMarketingService.sendPromotionalBlast(campaign._id!, channel);
    }
    res.status(201).json({ success: true, data: { campaign, promotionalBlast } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create campaign';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function expireCampaignsJob(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const expired = await campaignService.expireEndedCampaigns();
  res.json({ success: true, data: { expired } });
}

export async function updateCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const campaign = await campaignService.update(req.params.id, req.body);
    if (!campaign) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      return;
    }
    res.json({ success: true, data: campaign });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update campaign';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function deleteCampaign(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await campaignService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return;
  }
  res.status(204).send();
}
