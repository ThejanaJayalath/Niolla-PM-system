import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createReminder,
  getReminder,
  getRemindersByInquiry,
  getUpcomingReminders,
  updateReminder,
  deleteReminder,
} from '../controllers/ReminderController';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('owner', 'pm', 'employee'));

const validate = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg, details: errors.array() } });
  }
  next();
};

router.post(
  '/',
  [
    body('inquiryId').optional().isMongoId().withMessage('Valid inquiry ID is required'),
    body('type').isIn(['reminder', 'meeting']).withMessage('Type must be reminder or meeting'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('scheduledAt').isISO8601().withMessage('Valid scheduled date is required'),
    body('notes').optional().trim(),
    body('meetingDurationMinutes').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be 15–480 minutes'),
    body('attendees').optional().isArray().withMessage('attendees must be an array'),
    body('attendees.*').optional().isEmail().withMessage('Each attendee must be a valid email'),
    body('sendInvites').optional().isBoolean().withMessage('sendInvites must be boolean'),
    body('recurrence').optional().isArray().withMessage('recurrence must be an array of RRULE strings'),
  ],
  validate,
  createReminder
);

router.get('/upcoming', [query('limit').optional().isInt({ min: 1, max: 100 })], validate, getUpcomingReminders);
router.get('/inquiry/:inquiryId', [param('inquiryId').isMongoId()], validate, getRemindersByInquiry);
router.get('/:id', [param('id').isMongoId()], validate, getReminder);
router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('title').optional().trim().notEmpty(),
    body('scheduledAt').optional().isISO8601(),
    body('notes').optional().trim(),
    body('completed').optional().isBoolean(),
  ],
  validate,
  updateReminder
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteReminder);

export default router;
