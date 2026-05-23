import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getPayrollPreview, runMonthlyPayroll } from '../controllers/PayrollController';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('owner', 'pm'));

router.get('/preview', getPayrollPreview);
router.post('/run', runMonthlyPayroll);

export default router;
