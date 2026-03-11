import { Response } from 'express';
import { PaymentPlanService } from '../../application/services/PaymentPlanService';
import { AuthenticatedRequest } from '../middleware/auth';

const paymentPlanService = new PaymentPlanService();

export async function createPaymentPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId, downPaymentPct, downPaymentAmt, totalInstallments, installmentAmt, remainingBalance, serviceFeePct, serviceFeeAmt, planStartDate, status } =
    req.body;
  const plan = await paymentPlanService.create({
    projectId,
    downPaymentPct,
    downPaymentAmt,
    totalInstallments,
    installmentAmt,
    remainingBalance,
    serviceFeePct: serviceFeePct ?? 0,
    serviceFeeAmt: serviceFeeAmt ?? 0,
    planStartDate,
    status,
  });
  res.status(201).json({ success: true, data: plan });
}

export async function instantiatePaymentPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { projectId, templateId, planStartDate } = req.body;
    const plan = await paymentPlanService.instantiate({ projectId, templateId, planStartDate });
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'EXECUTION_FAILED', message: err instanceof Error ? err.message : 'Unknown error' }
    });
  }
}

export async function getPaymentPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const plan = await paymentPlanService.findById(req.params.id);
  if (!plan) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment plan not found' } });
    return;
  }
  res.json({ success: true, data: plan });
}

export async function listPaymentPlans(req: AuthenticatedRequest, res: Response): Promise<void> {
  const projectId = req.query.projectId as string | undefined;
  const status = req.query.status as string | undefined;
  const plans = await paymentPlanService.findAll({ projectId, status });
  res.json({ success: true, data: plans });
}

export async function updatePaymentPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const plan = await paymentPlanService.update(req.params.id, req.body);
  if (!plan) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment plan not found' } });
    return;
  }
  res.json({ success: true, data: plan });
}

export async function deletePaymentPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await paymentPlanService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment plan not found' } });
    return;
  }
  res.status(204).send();
}
