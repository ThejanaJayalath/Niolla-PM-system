import { Response } from 'express';
import { InstallmentService } from '../../application/services/InstallmentService';
import { AuthenticatedRequest } from '../middleware/auth';

const installmentService = new InstallmentService();

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
