import { Response } from 'express';
import { PaymentTransactionService } from '../../application/services/PaymentTransactionService';
import { AuthenticatedRequest } from '../middleware/auth';

const paymentTransactionService = new PaymentTransactionService();

export async function createPaymentTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const { installmentId, amount, paymentMethod, referenceNo, paymentDate } = req.body;
    const transaction = await paymentTransactionService.create({
      installmentId,
      amount,
      paymentMethod,
      referenceNo,
      paymentDate,
      recordedBy: userId,
    });
    res.status(201).json({ success: true, data: transaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record payment';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function getPaymentTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  const transaction = await paymentTransactionService.findById(req.params.id);
  if (!transaction) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment transaction not found' } });
    return;
  }
  res.json({ success: true, data: transaction });
}

export async function listPaymentTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const installmentId = req.query.installmentId as string | undefined;
  const clientId = req.query.clientId as string | undefined;
  const transactions = await paymentTransactionService.findAll({ installmentId, clientId });
  res.json({ success: true, data: transactions });
}
