import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createProposal,
  listProposals,
  getProposal,
  getProposalByInquiry,
  downloadProposalPdf,
} from '../controllers/ProposalController';

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
    body('inquiryId').isMongoId().withMessage('Valid inquiry ID is required'),
    body('projectName').optional().trim(),
    body('milestones').isArray({ min: 1 }).withMessage('At least one milestone is required'),
    body('milestones.*.title').trim().notEmpty().withMessage('Milestone title is required'),
    body('milestones.*.amount').optional().isNumeric().withMessage('Milestone amount must be a number when provided'),
    body('milestones.*.timePeriod').optional().trim(),
    body('milestones.*.description').optional().trim(),
    body('milestones.*.dueDate').optional().trim(),
    body('totalAmount').isNumeric().withMessage('Total cost for development (price) in LKR is required'),
    body('maintenanceCostPerMonth').optional().isNumeric(),
    body('maintenanceNote').optional().trim(),
    body('validUntil').optional().trim(),
    body('notes').optional().trim(),
  ],
  validate,
  createProposal
);

router.get('/', listProposals);
router.get('/inquiry/:inquiryId', [param('inquiryId').isMongoId()], validate, getProposalByInquiry);
router.get('/:id/pdf', [param('id').isMongoId()], validate, downloadProposalPdf);
router.get('/:id', [param('id').isMongoId()], validate, getProposal);

export default router;
