import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createInquiry,
  getInquiry,
  listInquiries,
  updateInquiry,
  deleteInquiry,
  checkDuplicatePhone,
} from '../controllers/InquiryController';

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
    body('customerName').trim().notEmpty().withMessage('Customer name is required'),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
    body('projectDescription').trim().notEmpty().withMessage('Project description is required'),
    body('requiredFeatures').isArray().withMessage('Required features must be an array'),
    body('internalNotes').optional().trim(),
  ],
  validate,
  createInquiry
);

router.get('/check-phone', [query('phoneNumber').notEmpty(), query('excludeId').optional().isMongoId()], validate, checkDuplicatePhone);
router.get('/', [query('status').optional().isIn(['new', 'contacted', 'proposal_sent', 'negotiating', 'won', 'lost'])], validate, listInquiries);
router.get('/:id', [param('id').isMongoId()], validate, getInquiry);
router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('customerName').optional().trim().notEmpty(),
    body('phoneNumber').optional().trim().notEmpty(),
    body('projectDescription').optional().trim().notEmpty(),
    body('requiredFeatures').optional().isArray(),
    body('internalNotes').optional().trim(),
    body('status').optional().isIn(['new', 'contacted', 'proposal_sent', 'negotiating', 'won', 'lost']),
  ],
  validate,
  updateInquiry
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteInquiry);

export default router;
