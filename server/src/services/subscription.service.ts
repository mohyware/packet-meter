import { and, desc, eq } from 'drizzle-orm';
import { db, users, subscriptions, UserWithSubscription } from '../db';
import { ReportTypeEnum } from '../db/enums';

export interface PlanFeatures {
  maxDevices: number;
  clearReportsInterval: number;
  emailReportsEnabled: boolean;
  reportType: (typeof ReportTypeEnum.enumValues)[number];
  planName: string;
}

export const DEFAULT_PLAN_FEATURES: PlanFeatures = {
  maxDevices: 3,
  clearReportsInterval: 1, // days
  emailReportsEnabled: false,
  reportType: 'total',
  planName: 'free',
};

export function getUserPlanFeatures(user: UserWithSubscription): PlanFeatures {
  if (
    !user.subscription ||
    user.subscription.status !== 'active' ||
    !user.subscription.plan
  ) {
    return DEFAULT_PLAN_FEATURES;
  }

  return {
    maxDevices: user.subscription.plan.maxDevices,
    clearReportsInterval: user.subscription.plan.clearReportsInterval,
    emailReportsEnabled: user.subscription.plan.emailReportsEnabled,
    reportType: user.subscription.plan.reportType,
    planName: user.subscription.plan.name,
  };
}

export async function requireSubscription(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('user_not_found');
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, 'active')
    ),
    with: {
      plan: true,
    },
    orderBy: desc(subscriptions.currentPeriodEnd),
  });

  const userWithSubscription: UserWithSubscription = {
    ...user,
    subscription: subscription
      ? {
          ...subscription,
          plan: subscription.plan,
        }
      : null,
  };

  return {
    user: userWithSubscription,
    features: getUserPlanFeatures(userWithSubscription),
  };
}
