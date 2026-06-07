import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createCampaign,
  deleteCampaign,
  expireCampaignsJob,
  getActiveCampaignsForProduct,
  getCampaign,
  listCampaigns,
  previewCampaignPricing,
  updateCampaign,
} from '../controllers/CampaignController';
import {
  listPromotionalProspects,
  previewPromotionalMessage,
  sendCampaignPromotionalBlast,
} from '../controllers/CampaignMarketingController';
import { getCampaignPerformanceReport } from '../controllers/CampaignReportController';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('owner', 'pm'));

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

router.get('/', listCampaigns);
router.get('/prospects', listPromotionalProspects);
router.post('/expire-ended', expireCampaignsJob);

router.get(
  '/preview',
  [
    query('originalAmount').isFloat({ min: 0 }).withMessage('originalAmount is required'),
    query('productId').optional().isMongoId(),
    query('inquiryId').optional().isMongoId(),
  ],
  validate,
  previewCampaignPricing
);

router.get('/product/:productId/active', [param('productId').isMongoId()], validate, getActiveCampaignsForProduct);

router.get('/:id/report', [param('id').isMongoId()], validate, getCampaignPerformanceReport);

router.get('/:id/promotional-preview', [param('id').isMongoId()], validate, previewPromotionalMessage);

router.post(
  '/:id/promotional-blast',
  [
    param('id').isMongoId(),
    body('channel').isIn(['email', 'sms']).withMessage('channel must be email or sms'),
    body('inquiryIds').optional().isArray(),
    body('inquiryIds.*').optional().isMongoId(),
  ],
  validate,
  sendCampaignPromotionalBlast
);

router.get('/:id', [param('id').isMongoId()], validate, getCampaign);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('discountType').optional().isIn(['percent', 'flat']),
    body('discountValue').optional().isFloat({ min: 0 }),
    body('discountType').optional().isIn(['percent', 'flat']),
    body('discountValue').optional().isFloat({ min: 0 }),
    body('discountPercent').optional().isFloat({ min: 0, max: 100 }),
    body('productScope').isIn(['all', 'specific']).withMessage('Product scope must be all or specific'),
    body('productIds').optional().isArray(),
    body('productIds.*').optional().isMongoId(),
    body('description').optional().trim(),
    body('status').optional().isIn(['active', 'inactive']),
    body('sendPromotionalBlast').optional().isBoolean(),
    body('promotionalChannel').optional().isIn(['email', 'sms']),
  ],
  validate,
  createCampaign
);

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('discountType').optional().isIn(['percent', 'flat']),
    body('discountValue').optional().isFloat({ min: 0 }),
    body('discountPercent').optional().isFloat({ min: 0, max: 100 }),
    body('productScope').optional().isIn(['all', 'specific']),
    body('productIds').optional().isArray(),
    body('productIds.*').optional().isMongoId(),
    body('description').optional().trim(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  validate,
  updateCampaign
);

router.delete('/:id', [param('id').isMongoId()], validate, deleteCampaign);

export default router;
