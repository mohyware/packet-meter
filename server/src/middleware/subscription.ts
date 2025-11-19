import { NextFunction, Request, Response } from 'express';
import {
  PlanFeatures,
  requireSubscription as fetchSubscription,
} from '../services/subscription.service';
import { UserWithSubscription } from '../db';
import logger from '../utils/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      planFeatures?: PlanFeatures;
      userWithSubscription?: UserWithSubscription;
    }
  }
}

export async function requirePlanFeatures(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.userId) {
    return res.status(401).json({ success: false, message: 'unauthorized' });
  }

  try {
    const { features, user } = await fetchSubscription(req.userId);
    req.planFeatures = features;
    req.userWithSubscription = user;
    return next();
  } catch (error: unknown) {
    logger.error('Plan feature middleware error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'failed to determine plan features' });
  }
}
