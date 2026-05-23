import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { INQUIRY_BUSINESS_MODEL_VALUES } from '../../constants/inquiryBusinessModels';
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

const businessModelValidators = [
  body('businessModel')
    .optional()
    .trim()
    .isIn([...INQUIRY_BUSINESS_MODEL_VALUES])
    .withMessage('Invalid business model'),
];

router.post(
  '/',
  [
    body('customerName').trim().notEmpty().withMessage('Customer name is required'),
    body('companyName').optional().trim(),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
    body('projectDescription').optional().trim(),
    body('requiredFeatures').optional().isArray().withMessage('Required features must be an array'),
    body('internalNotes').optional().trim(),
    body('dateOfBirth').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('dateOfBirth must be YYYY-MM-DD'),
    ...businessModelValidators,
  ],
  validate,
  createInquiry
);

// Status enum values (both casing supported)
const STATUS_VALUES = [
  'new', 'contacted', 'proposal_sent', 'negotiating', 'won', 'lost', 'confirmed', 'pending_advance',
  'NEW', 'CONTACTED', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON', 'LOST', 'CONFIRMED', 'PENDING_ADVANCE',
];

router.get('/check-phone', [query('phoneNumber').notEmpty(), query('excludeId').optional().isMongoId()], validate, checkDuplicatePhone);
router.get('/', [
  query('status').optional().isIn(STATUS_VALUES),
  query('search').optional().isString().trim(),
], validate, listInquiries);

router.get('/:id', [param('id').isMongoId()], validate, getInquiry);
router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('customerName').optional().trim().notEmpty(),
    body('companyName').optional().trim(),
    body('phoneNumber').optional().trim().notEmpty(),
    body('projectDescription').optional().trim(),
    body('requiredFeatures').optional().isArray(),
    body('internalNotes').optional().trim(),
    body('status').optional().isIn(STATUS_VALUES),
    body('dateOfBirth').optional({ values: 'null' }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('dateOfBirth must be YYYY-MM-DD'),
    ...businessModelValidators,
  ],
  validate,
  updateInquiry
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteInquiry);

export default router;
