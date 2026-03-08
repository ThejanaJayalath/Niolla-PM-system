import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createPaymentTransaction,
  getPaymentTransaction,
  listPaymentTransactions,
} from '../controllers/PaymentTransactionController';

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
    body('installmentId').isMongoId().withMessage('Valid installment ID is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('paymentMethod').isIn(['cash', 'bank', 'card', 'online']).withMessage('Invalid payment method'),
    body('referenceNo').optional().trim().isString(),
    body('paymentDate').isISO8601().withMessage('Valid payment date is required'),
  ],
  validate,
  createPaymentTransaction
);

router.get(
  '/',
  [
    query('installmentId').optional().isMongoId(),
    query('clientId').optional().isMongoId(),
  ],
  validate,
  listPaymentTransactions
);
router.get('/:id', [param('id').isMongoId()], validate, getPaymentTransaction);

export default router;
