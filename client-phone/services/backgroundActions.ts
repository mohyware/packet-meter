import BackgroundActions from 'react-native-background-actions';
import { reportTotalUsage, reportPerProcessUsage } from './reporting';
import { useReporterStore } from '@/store/useReporterStore';

type TaskParameters = {
  delay: number;
};

type TaskDataArguments = {
  parameters?: TaskParameters;
};

const sleep = (time: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), time));

/**
 * Background task handler that runs both total usage and per-process usage reports
 */
async function backgroundReportingTask(taskDataArguments?: TaskDataArguments) {
  const delay = taskDataArguments?.parameters?.delay;
  // Default to 15 minutes if not provided
  const intervalMs = delay || 15 * 60 * 1000;

  const intervalMinutes = intervalMs / (60 * 1000);

  await new Promise<void>(async () => {
    while (BackgroundActions.isRunning()) {
      try {
        const { deviceToken } = useReporterStore.getState();

        if (!deviceToken) {
          console.log('Background reporting task skipped: no device token');
          await sleep(intervalMs);
          continue;
        }

        console.log(
          `Running background reports (interval: ${intervalMinutes} min)...`
        );

        await reportTotalUsage();
        await sleep(5000);
        await reportPerProcessUsage();

        // Wait for the specified interval before next execution
        await sleep(intervalMs);
      } catch (err) {
        console.error('Background reporting task exception:', err);
        await sleep(intervalMs);
      }
    }
  });
}

const taskOptions = (intervalMinutes: number) => ({
  taskName: 'PacketPilot Reporter',
  taskTitle: 'PacketPilot Reporter',
  taskDesc: 'Reporting network usage data',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#5355C4',
  linkingURI: 'packetMeter://',
  parameters: {
    parameters: {
      delay: intervalMinutes * 60 * 1000,
    },
  } as unknown as TaskDataArguments,
});

/**
 * Start background tasks using react-native-background-actions
 * @param intervalMinutes - Interval in minutes (default: 15)
 */
export async function startBackgroundActions(
  intervalMinutes: number = 15
): Promise<void> {
  try {
    const isRunning = await BackgroundActions.isRunning();
    if (isRunning) {
      console.log('Background actions already running');
      return;
    }

    await BackgroundActions.start(
      backgroundReportingTask,
      taskOptions(intervalMinutes)
    );

    console.log(
      `Background actions started with ${intervalMinutes} minute interval`
    );
  } catch (err) {
    console.error('Failed to start background actions:', err);
  }
}

/**
 * Stop background actions
 */
export async function stopBackgroundActions(): Promise<void> {
  try {
    const isRunning = await BackgroundActions.isRunning();
    if (isRunning) {
      await BackgroundActions.stop();
      console.log('Background actions stopped');
    }
  } catch (err) {
    console.error('Failed to stop background actions:', err);
  }
}

/**
 * Check if background actions are running
 */
export async function isBackgroundActionsRunning(): Promise<boolean> {
  try {
    return await BackgroundActions.isRunning();
  } catch (err) {
    console.error('Failed to check background actions status:', err);
    return false;
  }
}
