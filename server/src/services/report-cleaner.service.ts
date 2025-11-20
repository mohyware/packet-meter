import type { ScheduledTask } from 'node-cron';
import * as cron from 'node-cron';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import logger from '../utils/logger';
import { db, devices, reports, settings, subscriptions } from '../db';

interface CleanupResult {
  totalUsers: number;
  processedUsers: number;
  skippedUsers: number;
  deletedReports: number;
}

let reportCleanerJob: ScheduledTask | null = null;

function resolveClearInterval(
  userSetting?: number,
  planLimit?: number
): number {
  if (userSetting === -1) {
    return -1;
  }

  if (typeof userSetting === 'number') {
    if (
      typeof planLimit === 'number' &&
      planLimit > 0 &&
      userSetting > planLimit
    ) {
      return planLimit;
    }

    return userSetting;
  }

  if (typeof planLimit === 'number') {
    return planLimit;
  }

  return 1;
}

async function clearReportsForUser(userId: string): Promise<{
  skipped: boolean;
  reason?: string;
  deleted?: number;
  intervalDays?: number;
}> {
  const userSettings = await db.query.settings.findFirst({
    where: eq(settings.userId, userId),
  });

  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, 'active')
    ),
    orderBy: desc(subscriptions.currentPeriodEnd),
    with: {
      plan: true,
    },
  });

  const planLimit = subscription?.plan?.maxClearReportsInterval;
  const intervalDays = resolveClearInterval(
    userSettings?.clearReportsInterval,
    planLimit
  );

  if (intervalDays === -1) {
    return { skipped: true, reason: 'unlimited' };
  }

  const userDevices = await db.query.devices.findMany({
    where: eq(devices.userId, userId),
    columns: {
      id: true,
    },
  });

  if (userDevices.length === 0) {
    return { skipped: true, reason: 'no_devices' };
  }

  const deviceIds = userDevices.map((device) => device.id);

  const cutoffDate = new Date(Date.now() - intervalDays * 24 * 60 * 60 * 1000);

  const deletedReports = await db
    .delete(reports)
    .where(
      and(
        inArray(reports.deviceId, deviceIds),
        lt(reports.timestamp, cutoffDate)
      )
    )
    .returning({
      id: reports.id,
    });

  return {
    skipped: false,
    deleted: deletedReports.length,
    intervalDays,
  };
}

export async function cleanOldReportsForAllUsers(): Promise<CleanupResult> {
  const allUsers = await db.query.users.findMany({
    columns: {
      id: true,
      username: true,
    },
  });

  let processedUsers = 0;
  let skippedUsers = 0;
  let deletedReports = 0;

  for (const user of allUsers) {
    try {
      const result = await clearReportsForUser(user.id);

      if (result.skipped) {
        skippedUsers++;
        if (result.reason === 'unlimited') {
          logger.info(
            `[ReportCleaner] Skipping ${user.username} (${user.id}) - unlimited retention`
          );
        }
        continue;
      }

      processedUsers++;
      deletedReports += result.deleted ?? 0;

      if ((result.deleted ?? 0) > 0) {
        logger.info(
          `[ReportCleaner] Deleted ${result.deleted} reports for ${user.username} (${user.id}) older than ${result.intervalDays} day(s)`
        );
      }
    } catch (error) {
      skippedUsers++;
      logger.error(
        `[ReportCleaner] Failed to clean reports for user ${user.username} (${user.id}):`,
        error
      );
    }
  }

  return {
    totalUsers: allUsers.length,
    processedUsers,
    skippedUsers,
    deletedReports,
  };
}

export function startReportCleanerScheduler(cronExpression?: string): void {
  const schedule = cronExpression ?? '0 0 * * *';

  if (reportCleanerJob) {
    logger.warn('Report cleaner scheduler is already running');
    return;
  }

  reportCleanerJob = cron.schedule(schedule, async () => {
    logger.info('Starting scheduled report cleanup job');
    try {
      const result = await cleanOldReportsForAllUsers();
      logger.info(
        `Report cleanup job finished: ${result.deletedReports} reports removed across ${result.processedUsers} users`
      );
    } catch (error) {
      logger.error('Scheduled report cleanup job failed:', error);
    }
  });

  logger.info(`Report cleaner scheduler started with schedule: ${schedule}`);
}

export function stopReportCleanerScheduler(): void {
  if (reportCleanerJob) {
    reportCleanerJob.stop();
    reportCleanerJob = null;
    logger.info('Report cleaner scheduler stopped');
  }
}

export async function triggerReportCleanup(): Promise<CleanupResult> {
  logger.info('Manually triggering report cleanup');
  return cleanOldReportsForAllUsers();
}
