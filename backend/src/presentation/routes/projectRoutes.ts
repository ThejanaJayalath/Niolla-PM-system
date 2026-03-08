import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
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

router.post(
  '/',
  [
    body('clientId').isMongoId().withMessage('Valid client (customer) ID is required'),
    body('projectName').trim().notEmpty().withMessage('Project name is required'),
    body('description').optional().trim(),
    body('systemType').optional().trim(),
    body('totalValue').isNumeric().withMessage('Total value must be a number'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
    body('status').optional().isIn(['active', 'completed', 'cancelled']),
  ],
  validate,
  createProject
);

router.get(
  '/',
  [
    query('clientId').optional().isMongoId(),
    query('status').optional().isIn(['active', 'completed', 'cancelled']),
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
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('status').optional().isIn(['active', 'completed', 'cancelled']),
  ],
  validate,
  updateProject
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteProject);

export default router;
