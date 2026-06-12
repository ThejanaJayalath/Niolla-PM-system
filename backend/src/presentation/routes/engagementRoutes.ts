import multer from 'multer';
import { Router } from 'express';
import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  generateAnniversaryCard,
  getEngagementStats,
  listFestivalProspects,
  listTodayAnniversaries,
  markEngagementResponse,
  sendAnniversaryCard,
  sendFestivalBlast,
} from '../controllers/EngagementController';
import {
  deleteGreetingTemplate,
  getGreetingTemplateInfo,
  listGreetingTemplates,
  previewGreetingTemplate,
  uploadGreetingTemplate,
} from '../controllers/GreetingCardTemplateController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

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

router.use(authMiddleware);
router.use(requireRole('owner', 'pm'));

router.get('/templates', listGreetingTemplates);
router.get('/templates/:templateType/preview', previewGreetingTemplate);
router.get('/templates/:templateType', getGreetingTemplateInfo);
router.post(
  '/templates/:templateType',
  upload.single('template'),
  uploadGreetingTemplate
);
router.delete('/templates/:templateType', deleteGreetingTemplate);

router.get('/anniversaries/today', listTodayAnniversaries);
router.get('/festival/prospects', listFestivalProspects);
router.get('/stats', getEngagementStats);

router.post(
  '/anniversaries/:projectId/generate-card',
  [param('projectId').isMongoId()],
  validate,
  generateAnniversaryCard
);

router.post(
  '/anniversaries/:projectId/send',
  [
    param('projectId').isMongoId(),
    body('channel').isIn(['email', 'whatsapp']),
    body('cardId').optional().isMongoId(),
    body('greetingMessage').optional().isString().trim(),
  ],
  validate,
  sendAnniversaryCard
);

router.post(
  '/festival/:festivalKey/blast',
  [
    param('festivalKey').isIn(['new_year', 'christmas', 'vesak', 'deepavali', 'general']),
    body('channel').isIn(['email', 'whatsapp']),
    body('inquiryIds').optional().isArray(),
    body('inquiryIds.*').optional().isMongoId(),
  ],
  validate,
  sendFestivalBlast
);

router.patch(
  '/cards/:cardId/response',
  [param('cardId').isMongoId(), body('responded').optional().isBoolean()],
  validate,
  markEngagementResponse
);

export default router;
