import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { runAnniversaryScanJob, runBirthdayScanJob, runUpdateOverdueJob } from '../controllers/JobController';
import { expireCampaignsJob } from '../controllers/CampaignController';

const router = Router();
router.use(authMiddleware);
/** Only owner can trigger jobs (e.g. for cron or manual run). */
router.use(requireRole('owner'));

router.get('/update-overdue', runUpdateOverdueJob);
router.get('/scan-birthdays', runBirthdayScanJob);
router.get('/scan-anniversaries', runAnniversaryScanJob);
router.get('/expire-campaigns', expireCampaignsJob);

export default router;
