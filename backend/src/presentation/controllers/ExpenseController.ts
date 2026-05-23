import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { ExpenseService } from '../../application/services/ExpenseService';
import { AuthenticatedRequest } from '../middleware/auth';

const expenseService = new ExpenseService();

export async function listExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));
  const category = req.query.category as string | undefined;
  const rows = await expenseService.list(limit, category);
  res.json({ success: true, data: rows });
}

export async function expenseSummary(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = await expenseService.summary();
  res.json({ success: true, data });
}

export async function getMarketingRoi(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const data = await expenseService.getMarketingRoi({ from, to });
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load marketing ROI';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
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
    const { category, amount, description, expenseDate, developerId, projectId } = req.body as {
      category: string;
      amount: number;
      description: string;
      expenseDate?: string;
      developerId?: string;
      projectId?: string;
    };
    const row = await expenseService.createManual({
      category: category as 'MARKETING' | 'STAFF_SALARIES' | 'INFRASTRUCTURE',
      amount: Number(amount),
      description,
      expenseDate: expenseDate || new Date().toISOString(),
      recordedByUserId: userId,
      developerId: developerId?.trim() || undefined,
      projectId: projectId?.trim() || undefined,
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create expense';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export const createExpenseValidators = [
  body('category').isIn(['MARKETING', 'STAFF_SALARIES', 'INFRASTRUCTURE', 'OPERATIONAL']).withMessage('Invalid category'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('expenseDate').optional().isISO8601().withMessage('Invalid date'),
  body('developerId').optional().isMongoId().withMessage('Invalid developer id'),
  body('projectId').optional().isMongoId().withMessage('Invalid project id'),
];
