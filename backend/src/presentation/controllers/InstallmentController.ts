import { Response } from 'express';
import { InstallmentService } from '../../application/services/InstallmentService';
import { AuthenticatedRequest } from '../middleware/auth';

const installmentService = new InstallmentService();

export async function createInstallment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { planId, installmentNo, dueDate, dueAmount, paidAmount, paidDate, status } = req.body;
  const installment = await installmentService.create({
    planId,
    installmentNo,
    dueDate,
    dueAmount,
    paidAmount,
    paidDate,
    status,
  });
  res.status(201).json({ success: true, data: installment });
}

export async function generateInstallments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const planId = req.body.planId as string;
  if (!planId) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'planId is required' } });
    return;
  }
  try {
    const installments = await installmentService.createManyForPlan(planId);
    res.status(201).json({ success: true, data: installments });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate installments';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function getInstallment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const installment = await installmentService.findById(req.params.id);
  if (!installment) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Installment not found' } });
    return;
  }
  res.json({ success: true, data: installment });
}

export async function listInstallments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const planId = req.query.planId as string | undefined;
  const status = req.query.status as string | undefined;
  const projectId = req.query.projectId as string | undefined;
  const installments = await installmentService.findAll({ planId, status, projectId });
  res.json({ success: true, data: installments });
}

export async function updateInstallment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const installment = await installmentService.update(req.params.id, req.body);
  if (!installment) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Installment not found' } });
    return;
  }
  res.json({ success: true, data: installment });
}

export async function deleteInstallment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await installmentService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Installment not found' } });
    return;
  }
  res.status(204).send();
}
