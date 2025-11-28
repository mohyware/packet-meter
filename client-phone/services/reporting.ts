import { useReporterStore } from '@/store/useReporterStore';
import type { AppRegistrationRequest, DeviceStatus, PerProcessUsageReportRequest } from '@/types/reports';
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
                'Authorization': `Bearer ${deviceToken}`,
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
        const responseText = await res.text().catch(() => '');
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
        Alert.alert('Permission required', 'Usage access permission is needed to collect network usage.');
        return false;
    }

    if (!deviceToken) {
        console.warn('reportTotalUsageSnapshot: missing DEVICE_TOKEN');
        setStatus('not_connected');
        return false;
    }

    let totals: TotalUsageDataAPI | null = null;
    try {
        totals = await apiGetTotalUsage('hour', 1);
    } catch (e) {
        console.error('Error getting total network usage:', e);
        Alert.alert('Report Total Usage', 'Failed to get total usage data.');
        return false;
    }

    if (!totals) {
        Alert.alert('Report Total Usage', 'No usage data available for the selected period.');
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
                'Authorization': `Bearer ${deviceToken}`,
                'User-Agent': 'PacketMeter-android/1.0',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            if (res.status === 403) {
                console.warn('Total usage report rejected (device pending approval)', text);
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
        Alert.alert('Permission required', 'Usage access permission is needed to collect network usage.');
        return false;
    }
    if (!deviceToken) {
        console.warn('reportPerProcessUsageSnapshot: missing DEVICE_TOKEN');
        setStatus('not_connected');
        return false;
    }

    const apps = (await apiGetAppUsage('day', 1)) as AppUsageDataAPI[] | null;
    if (!apps || apps.length === 0) {
        Alert.alert('Report Per App Usage', 'No per-app usage data available for the selected period.');
        return false;
    }
    const AppsToRegister: AppRegistrationRequest['Apps'] = apps
        .map((app: AppUsageDataAPI) => ({
            Identifier: app.packageName || `uid-${app.uid}`,
            DisplayName: app.appName || app.packageName || `UID ${app.uid}`,
            IconHash: app.icon,
        }))

    const AppsReport: PerProcessUsageReportRequest['Apps'] = apps
        .map((app: AppUsageDataAPI) => ({
            Identifier: app.packageName || `uid-${app.uid}`,
            TotalRx: (app.wifi?.rx ?? 0) + (app.mobile?.rx ?? 0),
            TotalTx: (app.wifi?.tx ?? 0) + (app.mobile?.tx ?? 0),
        }))
        .filter((app) => app.Identifier && (app.TotalRx > 0 || app.TotalTx > 0));

    if (!AppsToRegister.length || !AppsReport.length) {
        Alert.alert('Report Per App Usage', 'All apps show zero usage for the selected period.');
        return false;
    }

    await registerApps(
        AppsToRegister.map(app => ({
            Identifier: app.Identifier,
            DisplayName: app.DisplayName,
            IconHash: app.IconHash,
        }))
    );
    const timestamp = new Date().toISOString();

    const payload: PerProcessUsageReportRequest = {
        Timestamp: timestamp,
        Date: timestamp.split('T')[0],
        Apps: AppsReport
    }
    try {
        const url = buildServerUrl('/api/v1/traffic/per-process');
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deviceToken}`,
                'User-Agent': 'PacketMeter-android/1.0',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');

            if (res.status === 403) {
                console.warn('Per-process report rejected (device pending approval)', text);
                await healthCheck();
                setStatus('pending');
                return false;
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

async function registerApps(apps: {
    Identifier: string;
    DisplayName?: string | null;
    IconHash?: string | null;
}[]): Promise<void> {
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
                'Authorization': `Bearer ${deviceToken}`,
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

