import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { login, register } from '../controllers/AuthController';

const router = Router();

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg, details: errors.array() } });
    }
    next();
  },
  login
);

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('role').optional().isIn(['admin', 'user']),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg, details: errors.array() } });
    }
    next();
  },
  register
);

export default router;
