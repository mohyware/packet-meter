import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePlanFeatures } from '../middleware/subscription';
import {
  getSettingsForUser,
  updateSettingsForUser,
} from '../services/settings.service';
import { updateSettingsSchema } from './validation';
import { getErrorMessage } from '../utils/errors';
import { Setting } from '../db';

const router = Router();

function serializeSettings(record: Setting) {
  return {
    clearReportsInterval: record.clearReportsInterval,
    emailReportsEnabled: record.emailReportsEnabled,
    emailInterval: record.emailInterval,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
  };
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await getSettingsForUser(req.userId!);
    return res.json({
      success: true,
      settings: serializeSettings(settings),
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: 'failed to load settings',
      error: getErrorMessage(error),
    });
  }
});

router.put(
  '/',
  requireAuth,
  requirePlanFeatures,
  async (req: Request, res: Response) => {
    const parseResult = updateSettingsSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'invalid payload',
        error: parseResult.error.flatten(),
      });
    }

    const planFeatures = req.planFeatures;
    if (!planFeatures) {
      return res.status(500).json({
        success: false,
        message: 'failed to determine plan limits',
      });
    }

    const { clearReportsInterval, emailReportsEnabled, emailInterval } =
      parseResult.data;

    if (clearReportsInterval !== undefined) {
      if (
        planFeatures.maxClearReportsInterval >= 0 &&
        clearReportsInterval === -1
      ) {
        return res.status(403).json({
          success: false,
          message:
            'Your plan does not allow disabling automatic report clearing.',
        });
      }

      if (
        planFeatures.maxClearReportsInterval >= 0 &&
        clearReportsInterval > planFeatures.maxClearReportsInterval
      ) {
        return res.status(403).json({
          success: false,
          message: `Your plan allows a maximum clear interval of ${planFeatures.maxClearReportsInterval} day(s).`,
        });
      }
    }

    if (emailReportsEnabled !== undefined && emailReportsEnabled) {
      if (!planFeatures.emailReportsEnabled) {
        return res.status(403).json({
          success: false,
          message: 'Email reports are not available on your current plan.',
        });
      }
    }

    if (emailInterval !== undefined && !planFeatures.emailReportsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Email reports are not available on your current plan.',
      });
    }

    try {
      const updated = await updateSettingsForUser(
        req.userId!,
        parseResult.data
      );
      return res.json({
        success: true,
        message: 'settings updated',
        settings: serializeSettings(updated),
      });
    } catch (error: unknown) {
      return res.status(500).json({
        success: false,
        message: 'failed to update settings',
        error: getErrorMessage(error),
      });
    }
  }
);

export default router;
