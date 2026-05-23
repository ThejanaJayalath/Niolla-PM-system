import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProductSalesAnalytics,
  listProducts,
  updateProduct,
} from '../controllers/ProductController';

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
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('code').trim().notEmpty().withMessage('Product code is required'),
    body('description').optional().trim(),
    body('basePricing').isFloat({ min: 0 }).withMessage('Base pricing must be a non-negative number'),
    body('features').optional().isArray(),
    body('features.*').optional().trim(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  validate,
  createProduct
);

router.get(
  '/',
  [query('activeOnly').optional().isIn(['true', 'false'])],
  validate,
  listProducts
);

router.get('/sales/analytics', getProductSalesAnalytics);

router.get('/:id', [param('id').isMongoId()], validate, getProduct);

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('code').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('basePricing').optional().isFloat({ min: 0 }),
    body('features').optional().isArray(),
    body('features.*').optional().trim(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  validate,
  updateProduct
);

router.delete('/:id', [param('id').isMongoId()], validate, deleteProduct);

export default router;
