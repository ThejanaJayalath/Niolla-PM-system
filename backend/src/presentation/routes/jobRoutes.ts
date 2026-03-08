import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { runUpdateOverdueJob } from '../controllers/JobController';

const router = Router();
router.use(authMiddleware);
/** Only owner can trigger jobs (e.g. for cron or manual run). */
router.use(requireRole('owner'));

router.get('/update-overdue', runUpdateOverdueJob);

export default router;
