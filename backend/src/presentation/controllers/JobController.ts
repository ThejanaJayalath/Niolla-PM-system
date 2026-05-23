import { Response } from 'express';
import { InstallmentService } from '../../application/services/InstallmentService';
import { BirthdayService } from '../../application/services/BirthdayService';
import { EngagementService } from '../../application/services/EngagementService';
import { AuthenticatedRequest } from '../middleware/auth';

const installmentService = new InstallmentService();
const birthdayService = new BirthdayService();
const engagementService = new EngagementService();

/** Called by cron or manually to set overdue_days and status=overdue for past-due installments. */
export async function runUpdateOverdueJob(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const updated = await installmentService.updateOverdueInstallments();
    res.json({ success: true, data: { updated } });
  } catch (err) {
    console.error('Update overdue job error:', err);
    const message = err instanceof Error ? err.message : 'Job failed';
    res.status(500).json({ success: false, error: { code: 'JOB_ERROR', message } });
  }
}

/** Daily cron (~8 AM): notify owners about today's birthdays for the admin dashboard. */
export async function runBirthdayScanJob(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await birthdayService.scanAndNotifyOwners();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Birthday scan job error:', err);
    const message = err instanceof Error ? err.message : 'Job failed';
    res.status(500).json({ success: false, error: { code: 'JOB_ERROR', message } });
  }
}

/** Daily cron: notify owners about project first anniversaries today. */
export async function runAnniversaryScanJob(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await engagementService.scanAndNotifyOwnersAnniversaries();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Anniversary scan job error:', err);
    const message = err instanceof Error ? err.message : 'Job failed';
    res.status(500).json({ success: false, error: { code: 'JOB_ERROR', message } });
  }
}
