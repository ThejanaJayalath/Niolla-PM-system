import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { listUsers, addUser, removeUser, setUserPassword } from '../controllers/UserController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  requireRole('owner'),
  listUsers
);

router.post(
  '/',
  requireRole('owner'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('role').isIn(['pm', 'employee']).withMessage('Role must be pm or employee'),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg, details: errors.array() } });
    }
    next();
  },
  addUser
);

router.delete(
  '/:id',
  requireRole('owner'),
  param('id').isMongoId().withMessage('Invalid user ID'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg, details: errors.array() } });
    }
    next();
  },
  removeUser
);

router.patch(
  '/:id/password',
  requireRole('owner'),
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg, details: errors.array() } });
    }
    next();
  },
  setUserPassword
);

export default router;
