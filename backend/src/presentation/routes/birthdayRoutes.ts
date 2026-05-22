import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  generateBirthdayCard,
  getBirthdayCardImage,
  listTodayBirthdays,
  sendBirthdayCard,
} from '../controllers/BirthdayController';
import { validationResult } from 'express-validator';

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

const subjectTypeParam = param('subjectType').isIn(['customer', 'employee', 'inquiry']).withMessage('Invalid subject type');
const subjectIdParam = param('subjectId').isMongoId().withMessage('Invalid subject id');

/** Card images: Twilio needs a public URL; allow unauthenticated read when card id is known. */
router.get('/cards/:cardId/image', [param('cardId').isMongoId()], validate, getBirthdayCardImage);

router.use(authMiddleware);
router.use(requireRole('owner', 'pm'));

router.get('/today', listTodayBirthdays);

router.post(
  '/:subjectType/:subjectId/generate-card',
  [subjectTypeParam, subjectIdParam, body('greetingMessage').optional().isString().trim()],
  validate,
  generateBirthdayCard
);

router.post(
  '/:subjectType/:subjectId/send',
  [
    subjectTypeParam,
    subjectIdParam,
    body('channel').isIn(['email', 'whatsapp']).withMessage('channel must be email or whatsapp'),
    body('cardId').optional().isMongoId(),
    body('greetingMessage').optional().isString().trim(),
  ],
  validate,
  sendBirthdayCard
);

export default router;
