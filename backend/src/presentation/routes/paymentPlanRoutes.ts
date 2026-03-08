import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createPaymentPlan,
  getPaymentPlan,
  listPaymentPlans,
  updatePaymentPlan,
  deletePaymentPlan,
} from '../controllers/PaymentPlanController';

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

router.post(
  '/',
  [
    body('projectId').isMongoId().withMessage('Valid project ID is required'),
    body('downPaymentPct').isNumeric().withMessage('Down payment % must be a number'),
    body('downPaymentAmt').isNumeric().withMessage('Down payment amount must be a number'),
    body('totalInstallments').isInt({ min: 1, max: 24 }).withMessage('Total installments must be 1–24'),
    body('installmentAmt').isNumeric().withMessage('Installment amount must be a number'),
    body('remainingBalance').isNumeric().withMessage('Remaining balance must be a number'),
    body('planStartDate').optional().isISO8601().withMessage('Invalid plan start date'),
    body('status').optional().isIn(['active', 'completed', 'defaulted']),
  ],
  validate,
  createPaymentPlan
);

router.get(
  '/',
  [
    query('projectId').optional().isMongoId(),
    query('status').optional().isIn(['active', 'completed', 'defaulted']),
  ],
  validate,
  listPaymentPlans
);
router.get('/:id', [param('id').isMongoId()], validate, getPaymentPlan);
router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('downPaymentPct').optional().isNumeric(),
    body('downPaymentAmt').optional().isNumeric(),
    body('totalInstallments').optional().isInt({ min: 1, max: 24 }),
    body('installmentAmt').optional().isNumeric(),
    body('remainingBalance').optional().isNumeric(),
    body('planStartDate').optional().isISO8601(),
    body('status').optional().isIn(['active', 'completed', 'defaulted']),
  ],
  validate,
  updatePaymentPlan
);
router.delete('/:id', [param('id').isMongoId()], validate, deletePaymentPlan);

export default router;
