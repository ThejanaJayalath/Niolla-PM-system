import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { downloadPublicInvoicePdf } from '../controllers/InvoiceController';

const router = Router();

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
  '/:id/pdf',
  [
    param('id').isMongoId(),
    query('exp').isInt({ min: 1 }),
    query('sig').isString().notEmpty().matches(/^[a-f0-9]{64}$/i),
  ],
  validate,
  downloadPublicInvoicePdf
);

export default router;
