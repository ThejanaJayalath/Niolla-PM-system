import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  getMyPendingDeveloperEarnings,
  getDeveloperWallet,
  getDeveloperStaffAssignments,
  listMyRequirementTasks,
  listPendingPayoutApprovals,
  submitDeveloperPayoutCompletion,
  approveDeveloperPayoutRelease,
  getRequirementWorkflow,
  patchRequirementWorkflowAssignments,
  postAddonPaymentPlanForRequirement,
} from '../controllers/ProjectController';

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

router.get('/developer/pending-earnings', getMyPendingDeveloperEarnings);
router.get('/developer/wallet', getDeveloperWallet);
router.get('/developer/staff-assignments', getDeveloperStaffAssignments);
router.get('/developer/requirement-tasks', listMyRequirementTasks);
router.get('/admin/pending-payout-approvals', listPendingPayoutApprovals);
router.post(
  '/:id/payout-completion/submit',
  [param('id').isMongoId().withMessage('Invalid project id')],
  validate,
  submitDeveloperPayoutCompletion
);
router.post(
  '/:id/payout-completion/approve',
  [
    param('id').isMongoId().withMessage('Invalid project id'),
    body('developerId').isMongoId().withMessage('Valid developer id is required'),
  ],
  validate,
  approveDeveloperPayoutRelease
);

const PROJECT_LIFECYCLE_STATUSES = [
  'unassigned',
  'under_development',
  'completed',
  'suspended',
] as const;

router.get(
  '/:id/requirement-workflow',
  [param('id').isMongoId().withMessage('Invalid project id')],
  validate,
  getRequirementWorkflow
);
router.patch(
  '/:id/requirement-workflow/assignments',
  [
    param('id').isMongoId().withMessage('Invalid project id'),
    body('assignments').isObject().withMessage('assignments object required'),
    body('requirementPayoutValues').optional().isObject(),
  ],
  validate,
  patchRequirementWorkflowAssignments
);
router.post(
  '/:id/requirements/:requirementId/addon-payment-plan',
  [
    param('id').isMongoId(),
    param('requirementId').isMongoId(),
    body('totalValue').isFloat({ gt: 0 }),
    body('downPaymentPct').isFloat({ min: 0, max: 100 }),
    body('totalInstallments').isInt({ min: 1 }),
    body('serviceFeePct').optional().isFloat({ min: 0, max: 100 }),
    body('planStartDate').optional().isISO8601(),
  ],
  validate,
  postAddonPaymentPlanForRequirement
);

router.post(
  '/',
  [
    body('clientId').isMongoId().withMessage('Valid client (customer) ID is required'),
    body('projectName').trim().notEmpty().withMessage('Project name is required'),
    body('description').optional().trim(),
    body('systemType').optional().trim(),
    body('totalValue').isNumeric().withMessage('Total value must be a number'),
    body('startDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid start date'),
    body('endDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid end date'),
    body('status').optional().isIn(PROJECT_LIFECYCLE_STATUSES),
  ],
  validate,
  createProject
);

router.get(
  '/',
  [
    query('clientId').optional().isMongoId(),
    query('status').optional().isIn(PROJECT_LIFECYCLE_STATUSES),
    query('search').optional().isString().trim(),
  ],
  validate,
  listProjects
);
router.get('/:id', [param('id').isMongoId()], validate, getProject);
router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('projectName').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('systemType').optional().trim(),
    body('totalValue').optional().isNumeric(),
    body('startDate').optional({ values: 'falsy' }).isISO8601(),
    body('endDate').optional({ values: 'falsy' }).isISO8601(),
    body('status').optional().isIn(PROJECT_LIFECYCLE_STATUSES),
    body('assignedEmployees').optional().isArray(),
    body('assignedEmployees.*').optional().isMongoId(),
    body('assignedEmployeePayouts').optional().isObject(),
  ],
  validate,
  updateProject
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteProject);

export default router;
