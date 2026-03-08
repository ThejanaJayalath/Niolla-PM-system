import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createInstallment,
  generateInstallments,
  getInstallment,
  listInstallments,
  updateInstallment,
  deleteInstallment,
} from '../controllers/InstallmentController';

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
  '/generate',
  [body('planId').isMongoId().withMessage('Valid plan ID is required')],
  validate,
  generateInstallments
);

router.post(
  '/',
  [
    body('planId').isMongoId().withMessage('Valid plan ID is required'),
    body('installmentNo').isInt({ min: 1 }).withMessage('Installment number must be at least 1'),
    body('dueDate').isISO8601().withMessage('Valid due date is required'),
    body('dueAmount').isNumeric().withMessage('Due amount must be a number'),
    body('paidAmount').optional().isNumeric(),
    body('paidDate').optional().isISO8601(),
    body('status').optional().isIn(['pending', 'paid', 'partial', 'overdue']),
  ],
  validate,
  createInstallment
);

router.get(
  '/',
  [
    query('planId').optional().isMongoId(),
    query('status').optional().isIn(['pending', 'paid', 'partial', 'overdue']),
  ],
  validate,
  listInstallments
);
router.get('/:id', [param('id').isMongoId()], validate, getInstallment);
router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('dueDate').optional().isISO8601(),
    body('dueAmount').optional().isNumeric(),
    body('paidAmount').optional().isNumeric(),
    body('paidDate').optional().isISO8601(),
    body('status').optional().isIn(['pending', 'paid', 'partial', 'overdue']),
  ],
  validate,
  updateInstallment
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteInstallment);

export default router;
