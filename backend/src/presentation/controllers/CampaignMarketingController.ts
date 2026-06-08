import { Response } from 'express';
import { buildPromotionalMessage } from '../../domain/promotionalMessage';
import { CampaignMarketingService } from '../../application/services/CampaignMarketingService';
import { CampaignService } from '../../application/services/CampaignService';
import { AuthenticatedRequest } from '../middleware/auth';

const marketingService = new CampaignMarketingService();
const campaignService = new CampaignService();

export async function listPromotionalProspects(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const prospects = await marketingService.listProspects();
  res.json({ success: true, data: prospects });
}

export async function sendCampaignPromotionalBlast(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const channel = req.body.channel === 'email' ? 'email' : 'sms';
    const inquiryIds = Array.isArray(req.body.inquiryIds)
      ? (req.body.inquiryIds as string[]).filter(Boolean)
      : undefined;
    const data = await marketingService.sendPromotionalBlast(req.params.id, channel, inquiryIds);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Promotional blast failed';
    res.status(400).json({ success: false, error: { code: 'BLAST_ERROR', message } });
  }
}

export async function previewPromotionalMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const campaign = await campaignService.findById(req.params.id);
  if (!campaign) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return;
  }
  const prospects = await marketingService.listProspects();
  res.json({
    success: true,
    data: { message: buildPromotionalMessage(campaign), prospectCount: prospects.length },
  });
}
