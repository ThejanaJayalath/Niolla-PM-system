import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createCustomerCallLog,
  createCustomerInteraction,
  createCustomerRequirement,
  deleteCustomerCallLog,
  listCustomerCallLogs,
  listCustomerInteractions,
  listCustomerRequirements,
  updateCustomerCallLog,
  updateInteraction,
  updateRequirement,
  deleteCustomerRequirement,
} from '../controllers/InteractionController';

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

const interactionTypeList = ['CALL', 'MEETING', 'NOTE', 'STATUS_CHANGE', 'REQUIREMENT_UPDATE'];
const callDirectionList = ['INBOUND', 'OUTBOUND'];
const callOutcomeList = ['ANSWERED', 'NO_ANSWER', 'VOICEMAIL', 'FOLLOW_UP_REQUIRED', 'CLOSED'];
const requirementPriorityList = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const requirementStatusList = ['OPEN', 'IN_PROGRESS', 'DONE', 'DEFERRED'];
const requirementSourceList = ['INQUIRY', 'CALL', 'MEETING', 'MANUAL', 'CUSTOMER', 'CUSTOMER_PORTAL'];

router.get('/customers/:id/interactions', [param('id').isMongoId(), query('type').optional().isIn(interactionTypeList)], validate, listCustomerInteractions);
router.post(
  '/customers/:id/interactions',
  [
    param('id').isMongoId(),
    body('inquiryRef').optional().isMongoId(),
    body('type').isIn(interactionTypeList),
    body('summary').trim().notEmpty(),
    body('details').optional().trim(),
    body('occurredAt').optional().isISO8601(),
    body('callMeta').optional().isObject(),
    body('callMeta.direction').optional().isIn(callDirectionList),
    body('callMeta.durationSec').optional().isInt({ min: 0 }),
    body('callMeta.outcome').optional().isIn(callOutcomeList),
    body('callMeta.nextFollowUpAt').optional().isISO8601(),
  ],
  validate,
  createCustomerInteraction
);
router.patch(
  '/interactions/:interactionId',
  [
    param('interactionId').isMongoId(),
    body('summary').optional().trim().notEmpty(),
    body('details').optional().trim(),
    body('occurredAt').optional().isISO8601(),
    body('callMeta').optional().isObject(),
    body('callMeta.direction').optional().isIn(callDirectionList),
    body('callMeta.durationSec').optional().isInt({ min: 0 }),
    body('callMeta.outcome').optional().isIn(callOutcomeList),
    body('callMeta.nextFollowUpAt').optional().isISO8601(),
  ],
  validate,
  updateInteraction
);

router.get('/customers/:id/call-logs', [param('id').isMongoId()], validate, listCustomerCallLogs);
router.post(
  '/customers/:id/call-logs',
  [
    param('id').isMongoId(),
    body('inquiryRef').optional().isMongoId(),
    body('summary').trim().notEmpty(),
    body('details').optional().trim(),
    body('occurredAt').optional().isISO8601(),
    body('callMeta').optional().isObject(),
    body('callMeta.direction').optional().isIn(callDirectionList),
    body('callMeta.durationSec').optional().isInt({ min: 0 }),
    body('callMeta.outcome').optional().isIn(callOutcomeList),
    body('callMeta.nextFollowUpAt').optional().isISO8601(),
  ],
  validate,
  createCustomerCallLog
);
router.patch(
  '/customers/:id/call-logs/:interactionId',
  [
    param('id').isMongoId(),
    param('interactionId').isMongoId(),
    body('summary').optional().trim().notEmpty(),
    body('details').optional().trim(),
    body('occurredAt').optional().isISO8601(),
    body('callMeta').optional().isObject(),
    body('callMeta.direction').optional().isIn(callDirectionList),
    body('callMeta.durationSec').optional().isInt({ min: 0 }),
    body('callMeta.outcome').optional().isIn(callOutcomeList),
    body('callMeta.nextFollowUpAt').optional().isISO8601(),
  ],
  validate,
  updateCustomerCallLog
);
router.delete(
  '/customers/:id/call-logs/:interactionId',
  [param('id').isMongoId(), param('interactionId').isMongoId()],
  validate,
  deleteCustomerCallLog
);

router.get('/customers/:id/requirements', [param('id').isMongoId()], validate, listCustomerRequirements);
router.post(
  '/customers/:id/requirements',
  [
    param('id').isMongoId(),
    body('inquiryRef').optional().isMongoId(),
    body('projectRef').optional().isMongoId(),
    body('title').trim().notEmpty(),
    body('description').optional().trim(),
    body('priority').optional().isIn(requirementPriorityList),
    body('status').optional().isIn(requirementStatusList),
    body('source').optional().isIn(requirementSourceList),
    body('capturedAt').optional().isISO8601(),
    body('requirementPayoutValue')
      .optional({ nullable: true })
      .custom((v) => v === null || v === undefined || (Number.isFinite(Number(v)) && Number(v) >= 0))
      .withMessage('requirementPayoutValue must be null or a non-negative number'),
  ],
  validate,
  createCustomerRequirement
);
router.patch(
  '/requirements/:requirementId',
  [
    param('requirementId').isMongoId(),
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('priority').optional().isIn(requirementPriorityList),
    body('status').optional().isIn(requirementStatusList),
    body('source').optional().isIn(requirementSourceList),
    body('assignedEmployeeIds').optional().isArray(),
    body('assignedEmployeeIds.*').optional().isMongoId(),
    body('requirementPayoutValue')
      .optional({ nullable: true })
      .custom((v) => v === null || v === undefined || (Number.isFinite(Number(v)) && Number(v) >= 0))
      .withMessage('requirementPayoutValue must be null or a non-negative number'),
  ],
  validate,
  updateRequirement
);
router.delete(
  '/customers/:id/requirements/:requirementId',
  [param('id').isMongoId(), param('requirementId').isMongoId()],
  validate,
  deleteCustomerRequirement
);

export default router;
