import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listInvoices,
  getInvoice,
  downloadInvoicePdf,
} from '../controllers/InvoiceController';

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
    query('status').optional().isIn(['draft', 'sent', 'paid']),
  ],
  validate,
  listInvoices
);
router.get('/:id/pdf', [param('id').isMongoId()], validate, downloadInvoicePdf);
router.get('/:id', [param('id').isMongoId()], validate, getInvoice);

export default router;
