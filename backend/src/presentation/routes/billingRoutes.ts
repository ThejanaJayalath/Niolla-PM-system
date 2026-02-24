import multer from 'multer';
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createBilling,
  listBillings,
  getBilling,
  updateBilling,
  deleteBilling,
  uploadBillingTemplate,
  getBillingTemplateInfo,
  downloadBillingPdf,
  getRemainingAdvance,
} from '../controllers/BillingController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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
    body('customerName').trim().notEmpty().withMessage('Customer name is required'),
    body('projectName').optional().trim(),
    body('phoneNumber').optional().trim(),
    body('inquiryId').optional().isMongoId(),
    body('items').isArray().withMessage('Items must be an array'),
    body('items.*.amount').optional().isNumeric(),
    body('items.*.number').optional().trim(),
    body('items.*.description').optional().trim(),
    body('subTotal').optional().isNumeric(),
    body('advanceApplied').optional().isNumeric(),
    body('totalAmount').isNumeric().withMessage('Total amount is required'),
    body('billingType').optional().isIn(['NORMAL', 'ADVANCE', 'FINAL']),
    body('companyName').optional().trim(),
    body('address').optional().trim(),
    body('email').optional().trim(),
    body('billingDate').optional().isISO8601().withMessage('Invalid billing date'),
  ],
  validate,
  createBilling
);

router.get('/', listBillings);
router.get('/remaining-advance', [query('inquiryId').notEmpty().isMongoId().withMessage('inquiryId is required')], validate, getRemainingAdvance);
router.get('/template', getBillingTemplateInfo);
router.post('/template', upload.single('template'), uploadBillingTemplate);
router.get('/:id/pdf', [param('id').isMongoId()], validate, downloadBillingPdf);
router.get('/:id', [param('id').isMongoId()], validate, getBilling);
router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('companyName').optional().trim(),
    body('address').optional().trim(),
    body('email').optional().trim(),
    body('billingDate').optional().isISO8601(),
    body('items').optional().isArray(),
    body('items.*.amount').optional().isNumeric(),
    body('items.*.number').optional().trim(),
    body('items.*.description').optional().trim(),
    body('subTotal').optional().isNumeric(),
    body('advanceApplied').optional().isNumeric(),
    body('totalAmount').optional().isNumeric(),
    body('billingType').optional().isIn(['NORMAL', 'ADVANCE', 'FINAL']),
  ],
  validate,
  updateBilling
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteBilling);

export default router;
