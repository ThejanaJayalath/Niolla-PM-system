import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  approveUpdateCompletion,
  approveUpdateTicket,
  assignUpdateTicketDevelopers,
  cancelUpdateTicket,
  completeUpdateTicket,
  createUpdateTicket,
  createUpdateTicketBilling,
  getUpdateTicket,
  listMyUpdateTicketAssignments,
  listPendingReviewUpdateTickets,
  listUpdateTickets,
  setUpdateTicketPrice,
  updateUpdateTicket,
  workerCompleteUpdateTicket,
} from '../controllers/UpdateTicketController';

const router = Router();
router.use(authMiddleware);

const statusList = ['REQUESTED', 'PRICED', 'APPROVED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED'];

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

/** Worker portal — must be registered before admin-only middleware and /:id routes. */
router.get('/my-assignments', requireRole('employee'), listMyUpdateTicketAssignments);
router.patch(
  '/:id/worker-complete',
  requireRole('employee'),
  [param('id').isMongoId()],
  validate,
  workerCompleteUpdateTicket
);

router.use(requireRole('owner', 'pm'));

router.get('/pending-review', listPendingReviewUpdateTickets);

router.get(
  '/',
  [
    query('status').optional().isIn(statusList),
    query('customerRef').optional().isMongoId(),
    query('projectRef').optional().isMongoId(),
    query('search').optional().isString().trim(),
  ],
  validate,
  listUpdateTickets
);

router.get('/:id', [param('id').isMongoId()], validate, getUpdateTicket);

router.post(
  '/',
  [
    body('customerRef').isMongoId().withMessage('customerRef is required'),
    body('projectRef').isMongoId().withMessage('projectRef is required'),
    body('title').trim().notEmpty().withMessage('title is required'),
    body('description').optional().trim(),
    body('internalNotes').optional().trim(),
  ],
  validate,
  createUpdateTicket
);

router.patch(
  '/:id/price',
  [param('id').isMongoId(), body('quotedPrice').isFloat({ min: 0 }).withMessage('quotedPrice must be >= 0')],
  validate,
  setUpdateTicketPrice
);

router.patch('/:id/approve', [param('id').isMongoId()], validate, approveUpdateTicket);

router.patch(
  '/:id/assign',
  [
    param('id').isMongoId(),
    body('assignedEmployeeIds').optional().isArray(),
    body('assignedEmployeeIds.*').optional().isMongoId(),
    body('workerId').optional().isMongoId(),
    body('workerPayoutValue').optional().isFloat({ min: 0 }),
    body('developerPayoutValue').optional().isFloat({ min: 0 }),
  ],
  validate,
  assignUpdateTicketDevelopers
);

router.post(
  '/:id/billing',
  [
    param('id').isMongoId(),
    body('downPaymentPct').isFloat({ min: 0, max: 100 }),
    body('totalInstallments').isInt({ min: 1 }),
    body('serviceFeePct').optional().isFloat({ min: 0 }),
    body('planStartDate').optional().isISO8601(),
  ],
  validate,
  createUpdateTicketBilling
);

router.patch('/:id/complete', [param('id').isMongoId()], validate, completeUpdateTicket);

router.patch('/:id/approve-completion', [param('id').isMongoId()], validate, approveUpdateCompletion);

router.patch('/:id/cancel', [param('id').isMongoId()], validate, cancelUpdateTicket);

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('internalNotes').optional().trim(),
    body('status').optional().isIn(statusList),
  ],
  validate,
  updateUpdateTicket
);

export default router;
