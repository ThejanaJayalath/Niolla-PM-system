import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
} from '../controllers/ProjectTaskController';

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

router.get(
  '/',
  [query('projectId').optional().isMongoId().withMessage('Invalid projectId')],
  validate,
  listProjectTasks
);

router.post(
  '/',
  [
    body('projectId').isMongoId().withMessage('Valid projectId is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().isString(),
    body('requirementId').optional().isMongoId(),
    body('assigneeIds').optional().isArray(),
    body('assigneeIds.*').optional().isMongoId(),
  ],
  validate,
  createProjectTask
);

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('title').optional().trim().notEmpty(),
    body('description').optional().isString(),
    body('assigneeIds').optional().isArray(),
    body('assigneeIds.*').optional().isMongoId(),
    body('completed').optional().isBoolean(),
  ],
  validate,
  updateProjectTask
);

router.delete('/:id', [param('id').isMongoId()], validate, deleteProjectTask);

export default router;
