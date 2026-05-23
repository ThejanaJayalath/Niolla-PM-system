import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { PayrollService } from '../../application/services/PayrollService';

const payrollService = new PayrollService();

export async function getPayrollPreview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    const month = req.query.month ? parseInt(String(req.query.month), 10) : undefined;
    const data = await payrollService.preview(year, month);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load payroll preview';
    res.status(500).json({ success: false, error: { code: 'PAYROLL_ERROR', message } });
  }
}

export async function runMonthlyPayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const year = req.body?.year != null ? parseInt(String(req.body.year), 10) : undefined;
    const month = req.body?.month != null ? parseInt(String(req.body.month), 10) : undefined;
    const data = await payrollService.runMonth(year, month, userId);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payroll run failed';
    res.status(400).json({ success: false, error: { code: 'PAYROLL_ERROR', message } });
  }
}
