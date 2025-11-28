import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { reportTotalUsage, reportPerProcessUsage } from './reporting';
import { useReporterStore } from '@/store/useReporterStore';

export const TOTAL_USAGE_TASK = 'background-total-usage-report';
export const PER_PROCESS_USAGE_TASK = 'background-per-process-usage-report';

TaskManager.defineTask(
  TOTAL_USAGE_TASK,
  async ({ data, error, executionInfo }) => {
    if (error) {
      console.error('Total usage background task error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    try {
      const { deviceToken } = useReporterStore.getState();

      if (!deviceToken) {
        console.log('Total usage task skipped: no device token');
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      console.log('Running background total usage report...');
      const success = await reportTotalUsage();

      return success
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.Failed;
    } catch (err) {
      console.error('Total usage background task exception:', err);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  }
);

TaskManager.defineTask(
  PER_PROCESS_USAGE_TASK,
  async ({ data, error, executionInfo }) => {
    if (error) {
      console.error('Per-process usage background task error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    try {
      const { deviceToken } = useReporterStore.getState();

      if (!deviceToken) {
        console.log('Per-process usage task skipped: no device token');
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      console.log('Running background per-process usage report...');
      const success = await reportPerProcessUsage();

      return success
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.Failed;
    } catch (err) {
      console.error('Per-process usage background task exception:', err);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  }
);

/**
 * Register both background tasks for periodic execution
 * @param intervalMinutes - Interval in minutes (minimum 15 minutes on Android)
 */
export async function registerBackgroundTasks(
  intervalMinutes: number = 15
): Promise<void> {
  try {
    // Check if background fetch is available
    const status = await BackgroundFetch.getStatusAsync();

    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
      console.warn('Background fetch is restricted on this device');
      return;
    }

    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.warn(
        'Background fetch is denied. Please enable it in device settings.'
      );
      return;
    }

    // Register total usage task
    await BackgroundFetch.registerTaskAsync(TOTAL_USAGE_TASK, {
      minimumInterval: intervalMinutes * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    // Register per-process usage task
    await BackgroundFetch.registerTaskAsync(PER_PROCESS_USAGE_TASK, {
      minimumInterval: intervalMinutes * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log(
      `Background tasks registered with ${intervalMinutes} minute interval`
    );
  } catch (err) {
    console.error('Failed to register background tasks:', err);
  }
}

/**
 * Unregister all background tasks
 */
export async function unregisterBackgroundTasks(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(TOTAL_USAGE_TASK);
    await BackgroundFetch.unregisterTaskAsync(PER_PROCESS_USAGE_TASK);
    console.log('Background tasks unregistered');
  } catch (err) {
    console.error('Failed to unregister background tasks:', err);
  }
}

/**
 * Check if background tasks are registered
 */
export async function isBackgroundTasksRegistered(): Promise<boolean> {
  try {
    const tasks = await TaskManager.getRegisteredTasksAsync();
    return tasks.some(
      (task) =>
        task.taskName === TOTAL_USAGE_TASK ||
        task.taskName === PER_PROCESS_USAGE_TASK
    );
  } catch (err) {
    console.error('Failed to check background tasks status:', err);
    return false;
  }
}
