import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getPaymentSummary, getMonthlyCollection, getOverdueList } from '../controllers/ReportController';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('owner', 'pm', 'employee'));

const validate = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg, details: errors.array() },
    });
  }
  next();
};

router.get('/summary', getPaymentSummary);
router.get('/monthly-collection', [query('year').isInt({ min: 2020, max: 2100 }), query('month').isInt({ min: 1, max: 12 })], validate, getMonthlyCollection);
router.get('/overdue-list', getOverdueList);

export default router;
