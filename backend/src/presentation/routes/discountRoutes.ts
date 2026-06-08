/**
 * Product-linked discounts API (FestivalCampaign / Discount collection).
 * Alias routes for reporting and integrations that expect a "discounts" resource.
 */
import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listCampaigns, getCampaign } from '../controllers/CampaignController';
import { param, validationResult } from 'express-validator';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('owner', 'pm', 'employee'));

const validate = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg },
    });
  }
  next();
};

router.get('/', listCampaigns);
router.get('/:id', [param('id').isMongoId()], validate, getCampaign);

export default router;
