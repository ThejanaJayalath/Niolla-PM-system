import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { ExpenseService } from '../../application/services/ExpenseService';
import { AuthenticatedRequest } from '../middleware/auth';

const expenseService = new ExpenseService();

export async function listExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));
  const rows = await expenseService.list(limit);
  res.json({ success: true, data: rows });
}

export async function expenseSummary(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = await expenseService.summary();
  res.json({ success: true, data });
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.array()[0]?.msg || 'Validation failed' },
    });
    return;
  }
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const { category, amount, description, expenseDate } = req.body as {
      category: string;
      amount: number;
      description: string;
      expenseDate?: string;
    };
    const row = await expenseService.createManual({
      category: category as 'MARKETING' | 'STAFF_SALARIES' | 'OPERATIONAL',
      amount: Number(amount),
      description,
      expenseDate: expenseDate || new Date().toISOString(),
      recordedByUserId: userId,
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create expense';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export const createExpenseValidators = [
  body('category').isIn(['MARKETING', 'STAFF_SALARIES', 'OPERATIONAL']).withMessage('Invalid category'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('expenseDate').optional().isISO8601().withMessage('Invalid date'),
];
