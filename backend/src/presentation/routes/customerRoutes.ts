import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CUSTOMER_SERVICE_CATEGORY_VALUES } from '../../constants/customerServiceProducts';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
  deleteCustomer,
} from '../controllers/CustomerController';

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
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
    body('email').optional().trim(),
    body('projects').optional().isArray(),
    body('projects.*').optional().trim(),
    body('inquiryId').optional().isMongoId(),
    body('address').optional().trim(),
    body('businessType').optional().trim(),
    body('companyName').optional().trim(),
    body('nicNumber').optional().trim(),
    body('status').optional().isIn(['active', 'inactive']),
    body('productId').optional().isMongoId().withMessage('Invalid product'),
    body('serviceCategories').optional().isArray(),
    body('serviceCategories.*').optional().trim(),
    body('dateOfBirth').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('dateOfBirth must be YYYY-MM-DD'),
  ],
  validate,
  createCustomer
);

router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('productId').optional().isMongoId().withMessage('Invalid product filter'),
    query('serviceCategory')
      .optional({ values: 'falsy' })
      .isIn([...CUSTOMER_SERVICE_CATEGORY_VALUES])
      .withMessage('Invalid service category'),
  ],
  validate,
  listCustomers
);
router.get('/:id', [param('id').isMongoId()], validate, getCustomer);
router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('phoneNumber').optional().trim().notEmpty(),
    body('email').optional().trim(),
    body('projects').optional().isArray(),
    body('projects.*').optional().trim(),
    body('address').optional().trim(),
    body('businessType').optional().trim(),
    body('companyName').optional().trim(),
    body('nicNumber').optional().trim(),
    body('status').optional().isIn(['active', 'inactive']),
    body('productId').optional({ values: 'null' }).isMongoId().withMessage('Invalid product'),
    body('serviceCategories').optional().isArray(),
    body('serviceCategories.*').optional().trim(),
    body('dateOfBirth').optional({ values: 'null' }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('dateOfBirth must be YYYY-MM-DD'),
  ],
  validate,
  updateCustomer
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteCustomer);

export default router;
