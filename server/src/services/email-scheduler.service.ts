import cron from 'node-cron';
import logger from '../utils/logger';
import { sendDeviceStatsEmailsToAllUsers } from './email.service';

let emailJob: cron.ScheduledTask | null = null;

/**
 * Start the email scheduler
 * By default, sends emails daily at 9 AM UTC
 */
export function startEmailScheduler(cronExpression?: string): void {
  // Default: Daily at 9 AM UTC
  const schedule = cronExpression ?? '0 9 * * *';

  if (emailJob) {
    logger.warn('Email scheduler is already running');
    return;
  }

  emailJob = cron.schedule(schedule, async () => {
    logger.info('Starting scheduled device stats email job');
    try {
      const result = await sendDeviceStatsEmailsToAllUsers();
      logger.info(
        `Scheduled email job completed: ${result.sent}/${result.total} emails sent`
      );
    } catch (error: unknown) {
      logger.error('Scheduled email job failed:', error);
    }
  });

  logger.info(`Email scheduler started with schedule: ${schedule}`);
}

/**
 * Stop the email scheduler
 */
export function stopEmailScheduler(): void {
  if (emailJob) {
    emailJob.stop();
    emailJob = null;
    logger.info('Email scheduler stopped');
  }
}

/**
 * Manually trigger email sending (for testing or manual execution)
 */
export async function triggerEmailSending(): Promise<{
  total: number;
  sent: number;
  failed: number;
}> {
  logger.info('Manually triggering device stats email sending');
  return await sendDeviceStatsEmailsToAllUsers();
}
