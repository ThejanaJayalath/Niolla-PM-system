import { Response } from 'express';
import { EngagementService } from '../../application/services/EngagementService';
import { FestivalKey } from '../../domain/entities/Engagement';
import { AuthenticatedRequest } from '../middleware/auth';

const engagementService = new EngagementService();

const FESTIVAL_KEYS: FestivalKey[] = ['new_year', 'christmas', 'vesak', 'deepavali', 'general'];

function parseFestivalKey(raw: string): FestivalKey | null {
  return FESTIVAL_KEYS.includes(raw as FestivalKey) ? (raw as FestivalKey) : null;
}

export async function listTodayAnniversaries(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await engagementService.findTodayAnniversaries();
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load anniversaries';
    res.status(500).json({ success: false, error: { code: 'ENGAGEMENT_ERROR', message } });
  }
}

export async function listFestivalProspects(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const festivals = engagementService.listFestivalKeys();
    const prospects = await engagementService.listFestivalProspects();
    res.json({ success: true, data: { festivals, prospects } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load prospects';
    res.status(500).json({ success: false, error: { code: 'ENGAGEMENT_ERROR', message } });
  }
}

export async function getEngagementStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await engagementService.getEngagementOverview();
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load engagement stats';
    res.status(500).json({ success: false, error: { code: 'ENGAGEMENT_ERROR', message } });
  }
}

export async function generateAnniversaryCard(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await engagementService.generateAnniversaryCard(
      req.params.projectId,
      req.body?.greetingMessage
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate card';
    res.status(400).json({ success: false, error: { code: 'ENGAGEMENT_ERROR', message } });
  }
}

export async function sendAnniversaryCard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const channel = req.body?.channel;
  if (channel !== 'email' && channel !== 'whatsapp') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'channel must be email or whatsapp' },
    });
    return;
  }
  try {
    const data = await engagementService.sendAnniversary(req.params.projectId, channel, {
      cardId: req.body?.cardId,
      greetingMessage: req.body?.greetingMessage,
    });
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send card';
    res.status(400).json({ success: false, error: { code: 'ENGAGEMENT_ERROR', message } });
  }
}

export async function sendFestivalBlast(req: AuthenticatedRequest, res: Response): Promise<void> {
  const festivalKey = parseFestivalKey(req.params.festivalKey);
  const channel = req.body?.channel;
  if (!festivalKey) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid festival' } });
    return;
  }
  if (channel !== 'email' && channel !== 'whatsapp') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'channel must be email or whatsapp' },
    });
    return;
  }
  try {
    const data = await engagementService.sendFestivalBlast(
      festivalKey,
      channel,
      req.body?.inquiryIds
    );
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Festival blast failed';
    res.status(400).json({ success: false, error: { code: 'ENGAGEMENT_ERROR', message } });
  }
}

export async function markEngagementResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await engagementService.markCardResponded(req.params.cardId, req.body?.responded !== false);
    res.json({ success: true, data: { updated: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update response';
    res.status(400).json({ success: false, error: { code: 'ENGAGEMENT_ERROR', message } });
  }
}
