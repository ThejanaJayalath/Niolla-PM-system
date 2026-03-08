import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listPaymentNotifications,
  getPaymentNotification,
  markNotificationSent,
  createPaymentNotification,
} from '../controllers/PaymentNotificationController';

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

router.get(
  '/',
  [
    query('clientId').optional().isMongoId(),
    query('status').optional().isIn(['pending', 'sent', 'failed']),
    query('triggerType').optional().isIn(['due_reminder', 'overdue', 'receipt']),
  ],
  validate,
  listPaymentNotifications
);
router.get('/:id', [param('id').isMongoId()], validate, getPaymentNotification);
router.patch('/:id/sent', [param('id').isMongoId()], validate, markNotificationSent);
router.post(
  '/',
  [
    body('clientId').isMongoId().withMessage('Valid client ID is required'),
    body('installmentId').optional().isMongoId(),
    body('type').isIn(['sms', 'email', 'system']).withMessage('Invalid type'),
    body('triggerType').isIn(['due_reminder', 'overdue', 'receipt']).withMessage('Invalid trigger type'),
    body('scheduledAt').isISO8601().withMessage('Valid scheduled date is required'),
    body('messageBody').optional().trim(),
  ],
  validate,
  createPaymentNotification
);

export default router;
