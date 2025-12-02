import { useReporterStore } from '@/store/useReporterStore';
import type {
  AppRegistrationRequest,
  DeviceStatus,
  PerProcessUsageReportRequest,
  AppsNotFoundErrorResponse,
  ServerErrorResponse,
} from '@/types/reports';
import { AppUsageDataAPI, TotalUsageDataAPI } from '@/types/networkUsage';
import {
  apiCheckPermission,
  apiGetAppUsage,
  apiGetTotalUsage,
} from '@/services/networkUsageAPI';
import axios, { AxiosError, isAxiosError } from 'axios';

const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

function setStatus(status: DeviceStatus) {
  useReporterStore.setState({ deviceStatus: status });
}

function buildServerUrl(path: string): string {
  const { serverHost, serverPort, useTls } = useReporterStore.getState();
  const protocol = useTls ? 'https' : 'http';
  return `${protocol}://${serverHost}:${serverPort}${path}`;
}

export async function healthCheck(): Promise<{ ok: boolean; error?: string }> {
  const { deviceToken } = useReporterStore.getState();

  if (!deviceToken) {
    const error = 'Missing device token. Please configure your device token.';
    console.warn('healthCheck: missing DEVICE_TOKEN');
    setStatus('not_connected');
    return { ok: false, error };
  }
  try {
    const url = buildServerUrl('/api/v1/device/health-check');
    await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: `Bearer ${deviceToken}`,
          'User-Agent': 'PacketMeter-android-Daemon/0.1.0',
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );
    setStatus('pending');
    return { ok: true };
  } catch (err) {
    if (isAxiosError(err)) {
      const axiosError = err as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        const errorMessage = getErrorMessageFromResponse(status, data);

        if (status === 403) {
          setStatus('pending');
        }

        console.warn(`healthCheck failed HTTP ${status}:`, data);
        return { ok: false, error: errorMessage };
      } else if (axiosError.request) {
        let errorMessage =
          'Network error: Unable to connect to server. Please check your connection and server settings.';
        if (
          axiosError.code === 'ECONNABORTED' ||
          axiosError.message.includes('timeout')
        ) {
          errorMessage =
            'Request timeout: The server did not respond in time. Please check your connection and try again.';
        }
        console.error('healthCheck network error:', axiosError.message);
        return { ok: false, error: errorMessage };
      }
    }

    const errorMessage =
      err instanceof Error
        ? `Network error: ${err.message}`
        : 'Network error: Unable to connect to server. Please check your connection and server settings.';
    console.error('healthCheck error:', err);
    return { ok: false, error: errorMessage };
  }
}

function getErrorMessageFromResponse(status: number, data: unknown): string {
  if (status === 403) {
    return 'Device is pending approval. Please wait for admin approval.';
  } else if (status === 401) {
    return 'Unauthorized. Invalid device token.';
  } else if (status === 404) {
    return 'Server endpoint not found. Please verify server configuration.';
  } else if (status >= 500) {
    return `Server error (${status}). The server may be experiencing issues.`;
  } else if (data) {
    if (typeof data === 'string') {
      try {
        const errorData = JSON.parse(data);
        if (
          errorData &&
          typeof errorData === 'object' &&
          'message' in errorData
        ) {
          return String(errorData.message);
        } else {
          return data;
        }
      } catch {
        return data || `HTTP ${status}`;
      }
    } else if (typeof data === 'object' && data !== null && 'message' in data) {
      return String((data as { message: unknown }).message);
    } else if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data) || `HTTP ${status}`;
    }
  }
  return `HTTP ${status}`;
}

export async function reportTotalUsage(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { deviceToken } = useReporterStore.getState();

  const granted = await apiCheckPermission();
  if (!granted) {
    const error = 'Usage access permission is needed to collect network usage.';
    return { ok: false, error };
  }

  if (!deviceToken) {
    const error = 'Missing device token. Please configure your device token.';
    console.warn('reportTotalUsageSnapshot: missing DEVICE_TOKEN');
    setStatus('not_connected');
    return { ok: false, error };
  }

  let totals: TotalUsageDataAPI | null = null;
  try {
    totals = await apiGetTotalUsage('day', 1);
  } catch (e) {
    const error = 'Failed to get total usage data from device.';
    console.error('Error getting total network usage:', e);
    return { ok: false, error };
  }

  if (!totals) {
    const error = 'No usage data available for the selected period.';
    return { ok: false, error };
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
    await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
        'User-Agent': 'PacketMeter-android-Daemon/0.1.0',
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    setStatus('authed');
    return { ok: true };
  } catch (err) {
    if (isAxiosError(err)) {
      const axiosError = err as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        const errorMessage = getErrorMessageFromResponse(status, data);

        if (status === 403) {
          console.warn(
            'Total usage report rejected (device pending approval)',
            data
          );
          await healthCheck();
          setStatus('pending');
        }

        console.warn('Total usage report failed', status, data);
        return { ok: false, error: errorMessage };
      } else if (axiosError.request) {
        let errorMessage =
          'Network error: Unable to connect to server. Please check your connection and server settings.';
        if (
          axiosError.code === 'ECONNABORTED' ||
          axiosError.message.includes('timeout')
        ) {
          errorMessage =
            'Request timeout: The server did not respond in time. Please check your connection and try again.';
        }
        console.error(
          'reportTotalUsageSnapshot network error:',
          axiosError.message
        );
        return { ok: false, error: errorMessage };
      }
    }

    const errorMessage =
      err instanceof Error
        ? `Network error: ${err.message}`
        : 'Network error: Unable to connect to server. Please check your connection and server settings.';
    console.error('reportTotalUsageSnapshot failed:', err);
    return { ok: false, error: errorMessage };
  }
}

export async function reportPerProcessUsage(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { deviceToken } = useReporterStore.getState();

  const granted = await apiCheckPermission();
  if (!granted) {
    const error = 'Usage access permission is needed to collect network usage.';
    return { ok: false, error };
  }
  if (!deviceToken) {
    const error = 'Missing device token. Please configure your device token.';
    console.warn('reportPerProcessUsageSnapshot: missing DEVICE_TOKEN');
    setStatus('not_connected');
    return { ok: false, error };
  }

  const { detailedReports } = useReporterStore.getState();
  const apps = (await apiGetAppUsage('day', 1, detailedReports)) as
    | AppUsageDataAPI[]
    | null;
  if (!apps || apps.length === 0) {
    const error = 'No per-app usage data available for the selected period.';
    return { ok: false, error };
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
    const error = 'All apps show zero usage for the selected period.';
    return { ok: false, error };
  }

  const timestamp = new Date().toISOString();
  const payload: PerProcessUsageReportRequest = {
    Timestamp: timestamp,
    Date: timestamp.split('T')[0],
    Apps: AppsReport,
  };

  // We send the report if it fails cause of missing apps we register them and send the report again
  const url = buildServerUrl('/api/v1/traffic/per-process');
  try {
    await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
        'User-Agent': 'PacketMeter-android-Daemon/0.1.0',
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    setStatus('authed');
    return { ok: true };
  } catch (err) {
    if (isAxiosError(err)) {
      const axiosError = err as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        let errorData: ServerErrorResponse | null = null;

        if (typeof data === 'object' && data !== null) {
          errorData = data as ServerErrorResponse;
        }

        if (status === 403) {
          const errorMessage =
            'Device is pending approval. Please wait for admin approval.';
          console.warn(
            'Per-process report rejected (device pending approval)',
            data
          );
          await healthCheck();
          setStatus('pending');
          return { ok: false, error: errorMessage };
        }

        if (
          status === 400 &&
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
                      app.appName ||
                      app.packageName ||
                      `UID ${app.uid}` ||
                      null,
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

            try {
              await axios.post(url, payload, {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${deviceToken}`,
                  'User-Agent': 'PacketMeter-android-Daemon/0.1.0',
                },
                timeout: REQUEST_TIMEOUT_MS,
              });

              setStatus('authed');
              return { ok: true };
            } catch (retryErr) {
              if (isAxiosError(retryErr) && retryErr.response) {
                const retryStatus = retryErr.response.status;
                const retryData = retryErr.response.data;
                const errorMessage = getErrorMessageFromResponse(
                  retryStatus,
                  retryData
                );

                if (retryStatus === 403) {
                  console.warn(
                    'Per-process report rejected after app registration',
                    retryData
                  );
                  await healthCheck();
                  setStatus('pending');
                }

                console.warn(
                  'Per-process report failed after retry',
                  retryStatus,
                  retryData
                );
                return { ok: false, error: errorMessage };
              }
              throw retryErr;
            }
          } else {
            const error = 'No valid app data found for missing apps.';
            console.warn(error);
            return { ok: false, error };
          }
        }

        const errorMessage = getErrorMessageFromResponse(status, data);
        console.warn('Per-process report failed', status, data);
        return { ok: false, error: errorMessage };
      } else if (axiosError.request) {
        let errorMessage =
          'Network error: Unable to connect to server. Please check your connection and server settings.';
        if (
          axiosError.code === 'ECONNABORTED' ||
          axiosError.message.includes('timeout')
        ) {
          errorMessage =
            'Request timeout: The server did not respond in time. Please check your connection and try again.';
        }
        console.error(
          'reportPerProcessUsageSnapshot network error:',
          axiosError.message
        );
        return { ok: false, error: errorMessage };
      }
    }

    const errorMessage =
      err instanceof Error
        ? `Network error: ${err.message}`
        : 'Network error: Unable to connect to server. Please check your connection and server settings.';
    console.error('reportPerProcessUsageSnapshot failed:', err);
    return { ok: false, error: errorMessage };
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
    await axios.post(
      url,
      { Apps: apps },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deviceToken}`,
          'User-Agent': 'PacketMeter-android-Daemon/0.1.0',
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );
  } catch (err) {
    console.warn('registerApps failed', err);
  }
}
