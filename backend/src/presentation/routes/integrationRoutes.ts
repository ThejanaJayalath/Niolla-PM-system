import { Router, Response } from 'express';
import { getGoogleRefreshToken } from '../../application/services/IntegrationService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/google-calendar/status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const token = await getGoogleRefreshToken();
    const fromEnv = !!process.env.GOOGLE_REFRESH_TOKEN;
    const connected = !!(token || fromEnv);
    res.json({ success: true, data: { connected } });
  } catch (err) {
    console.error('[Integrations] Google Calendar status error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTEGRATION_ERROR', message: 'Failed to get Google Calendar status' },
    });
  }
});

export default router;
