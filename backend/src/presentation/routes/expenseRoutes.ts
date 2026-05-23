import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { createExpense, createExpenseValidators, expenseSummary, getMarketingRoi, listExpenses } from '../controllers/ExpenseController';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('owner', 'pm'));

router.get('/summary', expenseSummary);
router.get('/marketing-roi', getMarketingRoi);
router.get('/', listExpenses);
router.post('/', ...createExpenseValidators, createExpense);

export default router;
