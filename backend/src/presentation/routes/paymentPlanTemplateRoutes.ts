import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
    createTemplate,
    getTemplates,
    updateTemplate,
    deleteTemplate,
} from '../controllers/PaymentPlanTemplateController';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('owner', 'pm', 'employee'));

const validate = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg },
        });
    }
    next();
};

router.post(
    '/',
    [
        body('name').notEmpty().withMessage('Template name is required'),
        body('downPaymentPct').isNumeric(),
        body('installmentsCount').isInt({ min: 1 }),
        body('installmentPct').isNumeric(),
    ],
    validate,
    createTemplate
);

router.get('/', getTemplates);

router.patch(
    '/:id',
    [param('id').isMongoId()],
    validate,
    updateTemplate
);

router.delete('/:id', [param('id').isMongoId()], validate, deleteTemplate);

export default router;
