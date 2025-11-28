import { useReporterStore } from '@/store/useReporterStore';
import type {
  AppRegistrationRequest,
  DeviceStatus,
  PerProcessUsageReportRequest,
  AppsNotFoundErrorResponse,
  ServerErrorResponse,
} from '@/types/reports';
import { Alert } from 'react-native';
import { AppUsageDataAPI, TotalUsageDataAPI } from '@/types/networkUsage';
import {
  apiCheckPermission,
  apiGetAppUsage,
  apiGetTotalUsage,
} from '@/services/networkUsageAPI';

function setStatus(status: DeviceStatus) {
  useReporterStore.setState({ deviceStatus: status });
}

function buildServerUrl(path: string): string {
  const { serverHost, serverPort, useTls } = useReporterStore.getState();
  const protocol = useTls ? 'https' : 'http';
  return `${protocol}://${serverHost}:${serverPort}${path}`;
}

export async function healthCheck(): Promise<boolean> {
  const { deviceToken } = useReporterStore.getState();

  if (!deviceToken) {
    console.warn('healthCheck: missing DEVICE_TOKEN');
    setStatus('not_connected');
    return false;
  }
  try {
    const url = buildServerUrl('/api/v1/device/health-check');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deviceToken}`,
        'User-Agent': 'PacketMeter-android/1.0',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`healthCheck failed HTTP ${res.status}: ${text}`);
      if (res.status === 403) {
        setStatus('pending');
      }
      return false;
    }
    await res.text().catch(() => '');
    setStatus('pending');
    return true;
  } catch (err) {
    console.error('healthCheck error:', err);
    return false;
  }
}

export async function reportTotalUsage(): Promise<boolean> {
  const { deviceToken } = useReporterStore.getState();

  const granted = await apiCheckPermission();
  if (!granted) {
    Alert.alert(
      'Permission required',
      'Usage access permission is needed to collect network usage.'
    );
    return false;
  }

  if (!deviceToken) {
    console.warn('reportTotalUsageSnapshot: missing DEVICE_TOKEN');
    setStatus('not_connected');
    return false;
  }

  let totals: TotalUsageDataAPI | null = null;
  try {
    totals = await apiGetTotalUsage('day', 1);
  } catch (e) {
    console.error('Error getting total network usage:', e);
    Alert.alert('Report Total Usage', 'Failed to get total usage data.');
    return false;
  }

  if (!totals) {
    Alert.alert(
      'Report Total Usage',
      'No usage data available for the selected period.'
    );
    return false;
  }

  const totalRx = totals.wifi?.rx ?? 0;
  const totalTx = totals.wifi?.tx ?? 0;

  const timestamp = new Date().toISOString();
  const payload = {
    Timestamp: timestamp,
    Date: timestamp.split('T')[0],
    TotalRx: Math.max(0, Math.floor(totalRx)),
    TotalTx: Math.max(0, Math.floor(totalTx)),
  };

  try {
    const url = buildServerUrl('/api/v1/traffic/total-usage');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
        'User-Agent': 'PacketMeter-android/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 403) {
        console.warn(
          'Total usage report rejected (device pending approval)',
          text
        );
        await healthCheck();
        setStatus('pending');
        return false;
      }

      console.warn('Total usage report failed', res.status, text);
      return false;
    }

    setStatus('authed');
    return true;
  } catch (err) {
    console.error('reportTotalUsageSnapshot failed:', err);
    return false;
  }
}

export async function reportPerProcessUsage(): Promise<boolean> {
  const { deviceToken } = useReporterStore.getState();

  const granted = await apiCheckPermission();
  if (!granted) {
    Alert.alert(
      'Permission required',
      'Usage access permission is needed to collect network usage.'
    );
    return false;
  }
  if (!deviceToken) {
    console.warn('reportPerProcessUsageSnapshot: missing DEVICE_TOKEN');
    setStatus('not_connected');
    return false;
  }

  const apps = (await apiGetAppUsage('day', 1)) as AppUsageDataAPI[] | null;
  if (!apps || apps.length === 0) {
    Alert.alert(
      'Report Per App Usage',
      'No per-app usage data available for the selected period.'
    );
    return false;
  }

  const appDataMap = new Map<string, AppUsageDataAPI>();
  apps.forEach((app: AppUsageDataAPI) => {
    const identifier = app.packageName || `uid-${app.uid}`;
    appDataMap.set(identifier, app);
  });

  const AppsReport: PerProcessUsageReportRequest['Apps'] = apps
    .map((app: AppUsageDataAPI) => ({
      Identifier: app.packageName || `uid-${app.uid}`,
      TotalRx: (app.wifi?.rx ?? 0) + (app.mobile?.rx ?? 0),
      TotalTx: (app.wifi?.tx ?? 0) + (app.mobile?.tx ?? 0),
    }))
    .filter((app) => app.Identifier && (app.TotalRx > 0 || app.TotalTx > 0));

  if (!AppsReport.length) {
    Alert.alert(
      'Report Per App Usage',
      'All apps show zero usage for the selected period.'
    );
    return false;
  }

  const timestamp = new Date().toISOString();
  const payload: PerProcessUsageReportRequest = {
    Timestamp: timestamp,
    Date: timestamp.split('T')[0],
    Apps: AppsReport,
  };

  // We send the report if it fails cause of missing apps we register them and send the report again
  try {
    const url = buildServerUrl('/api/v1/traffic/per-process');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
        'User-Agent': 'PacketMeter-android/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let errorData: ServerErrorResponse | null = null;
      errorData = JSON.parse(text) as ServerErrorResponse;
      if (res.status === 403) {
        console.warn(
          'Per-process report rejected (device pending approval)',
          text
        );
        await healthCheck();
        setStatus('pending');
        return false;
      }

      if (
        res.status === 400 &&
        errorData &&
        'missingApps' in errorData &&
        errorData.message === 'apps_not_found'
      ) {
        const appsNotFoundError = errorData as AppsNotFoundErrorResponse;
        console.log(
          'Missing apps detected, registering them:',
          appsNotFoundError.missingApps
        );

        const appsToRegister: AppRegistrationRequest['Apps'] =
          appsNotFoundError.missingApps
            .map(
              (
                identifier: string
              ): AppRegistrationRequest['Apps'][number] | null => {
                const app = appDataMap.get(identifier);
                if (!app) {
                  console.warn(
                    `Could not find app data for identifier: ${identifier}`
                  );
                  return null;
                }
                return {
                  Identifier: identifier,
                  DisplayName:
                    app.appName || app.packageName || `UID ${app.uid}` || null,
                  IconHash: app.icon || null,
                };
              }
            )
            .filter(
              (app): app is AppRegistrationRequest['Apps'][number] =>
                app !== null
            );

        if (appsToRegister.length > 0) {
          await registerApps(appsToRegister);

          const retryRes = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${deviceToken}`,
              'User-Agent': 'PacketMeter-android/1.0',
            },
            body: JSON.stringify(payload),
          });

          if (!retryRes.ok) {
            const retryText = await retryRes.text().catch(() => '');
            if (retryRes.status === 403) {
              console.warn(
                'Per-process report rejected after app registration',
                retryText
              );
              await healthCheck();
              setStatus('pending');
              return false;
            }
            console.warn(
              'Per-process report failed after retry',
              retryRes.status,
              retryText
            );
            return false;
          }

          setStatus('authed');
          return true;
        } else {
          console.warn('No valid app data found for missing apps');
          return false;
        }
      }

      console.warn('Per-process report failed', res.status, text);
      return false;
    }

    setStatus('authed');
    return true;
  } catch (err) {
    console.error('reportPerProcessUsageSnapshot failed:', err);
    return false;
  }
}

async function registerApps(
  apps: {
    Identifier: string;
    DisplayName?: string | null;
    IconHash?: string | null;
  }[]
): Promise<void> {
  const { deviceToken } = useReporterStore.getState();

  if (!deviceToken || !apps?.length) {
    return;
  }

  try {
    const url = buildServerUrl('/api/v1/traffic/register-apps');
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
        'User-Agent': 'PacketMeter-android/1.0',
      },
      body: JSON.stringify({
        Apps: apps,
      }),
    });
  } catch (err) {
    console.warn('registerApps failed', err);
  }
}
