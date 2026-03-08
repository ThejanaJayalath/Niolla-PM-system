import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listAuditLogs, getAuditLog } from '../controllers/AuditLogController';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('owner', 'pm'));

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
  [
    query('userId').optional().isMongoId(),
    query('action').optional().trim(),
    query('tableName').optional().trim(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
  ],
  validate,
  listAuditLogs
);
router.get('/:id', [param('id').isMongoId()], validate, getAuditLog);

export default router;
