import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';
import { triggerEmailSending } from '../services/email-scheduler.service';

const router = Router();

/**
 * POST /api/v1/email/send-stats
 * Manually trigger sending device stats emails to all eligible users
 */
router.post('/send-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    logger.info(`Manual email trigger requested by user ${req.userId}`);

    const result = await triggerEmailSending();

    return res.json({
      success: true,
      message: 'Email sending completed',
      result: {
        total: result.total,
        sent: result.sent,
        failed: result.failed,
      },
    });
  } catch (error: unknown) {
    logger.error('Manual email trigger error:', error);
    return res.status(500).json({
      success: false,
      message: 'internal server error',
    });
  }
});

export default router;
