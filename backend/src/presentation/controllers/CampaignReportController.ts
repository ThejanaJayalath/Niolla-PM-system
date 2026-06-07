import { Response } from 'express';
import { CampaignReportService } from '../../application/services/CampaignReportService';
import { AuthenticatedRequest } from '../middleware/auth';

const campaignReportService = new CampaignReportService();

export async function getCampaignPerformanceReport(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const report = await campaignReportService.getPerformanceReport(req.params.id);
  if (!report) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return;
  }
  res.json({ success: true, data: report });
}
