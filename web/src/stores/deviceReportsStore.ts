import { useEffect } from 'react';
import { create } from 'zustand';
import { useQuery } from '@tanstack/react-query';
import { devicesApi, DeviceUsageReport } from '../api/devices';
import { useTimePeriodStore } from './timePeriodStore';

interface DeviceReportsState {
    reports: DeviceUsageReport[];
    allAppsReport: DeviceUsageReport | null;
    selectedReport: DeviceUsageReport | null;
    isLoading: boolean;
    error: Error | null;
    setReports: (reports: DeviceUsageReport[]) => void;
    setSelectedReport: (report: DeviceUsageReport | null) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: Error | null) => void;
    clearReports: () => void;
    calculateAllAppsReport: () => DeviceUsageReport | null;
}

export const useDeviceReportsStore = create<DeviceReportsState>((set, get) => ({
    reports: [],
    allAppsReport: null,
    selectedReport: null,
    isLoading: false,
    error: null,

    setReports: (reports: DeviceUsageReport[]) => {
        set({ reports });
        const appStats = get().calculateAllAppsReport();
        const currentSelected = get().selectedReport;
        const newSelectedReport = (!currentSelected || currentSelected.id === 'all-reports')
            ? appStats
            : currentSelected;

        set({ allAppsReport: appStats, selectedReport: newSelectedReport });
    },

    setSelectedReport: (report: DeviceUsageReport | null) => {
        set({ selectedReport: report });
    },

    setLoading: (isLoading: boolean) => {
        set({ isLoading });
    },

    setError: (error: Error | null) => {
        set({ error });
    },

    clearReports: () => {
        set({
            reports: [],
            allAppsReport: null,
            selectedReport: null,
            isLoading: false,
            error: null,
        });
    },

    calculateAllAppsReport: () => {
        const { reports } = get();
        if (reports.length === 0) return null;

        const sortedReports = [...reports].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const appMap = new Map<string, { totalRx: bigint; totalTx: bigint; identifier: string; displayName: string | null }>();

        let totalRx = BigInt(0);
        let totalTx = BigInt(0);
        const timestamps = sortedReports.map(r => new Date(r.timestamp).getTime());
        const minTimestamp = Math.min(...timestamps);

        for (const report of sortedReports) {
            totalRx += BigInt(report.totalRx);
            totalTx += BigInt(report.totalTx);

            for (const app of report.apps) {
                const existing = appMap.get(app.identifier);
                if (existing) {
                    existing.totalRx += BigInt(app.totalRx);
                    existing.totalTx += BigInt(app.totalTx);
                } else {
                    appMap.set(app.identifier, {
                        totalRx: BigInt(app.totalRx),
                        totalTx: BigInt(app.totalTx),
                        identifier: app.identifier,
                        displayName: app.displayName,
                    });
                }
            }
        }

        const aggregatedApps = Array.from(appMap.values()).map(app => ({
            id: app.identifier,
            identifier: app.identifier,
            displayName: app.displayName,
            totalRx: app.totalRx.toString(),
            totalTx: app.totalTx.toString(),
        }));

        // Create app stats report
        const aggregatedReport: DeviceUsageReport = {
            id: 'all-reports',
            deviceId: sortedReports[0]?.deviceId ?? '',
            timestamp: new Date(minTimestamp).toISOString(),
            totalRx: totalRx.toString(),
            totalTx: totalTx.toString(),
            apps: aggregatedApps,
        };

        return aggregatedReport;
    },
}));

// Hook that integrates React Query with Zustand stores
export const useDeviceReports = (deviceId: string | null) => {
    const { selectedPeriod, selectedCount } = useTimePeriodStore();
    const { setReports, setLoading, setError } = useDeviceReportsStore();

    const { data, isLoading, error } = useQuery({
        queryKey: ['devices', deviceId, 'usage', 1000, selectedPeriod, selectedCount],
        queryFn: () => {
            if (!deviceId) throw new Error('Device ID is required');
            return devicesApi.getDeviceUsage(
                deviceId,
                1000,
                selectedPeriod ?? undefined,
                selectedPeriod ? selectedCount : undefined
            );
        },
        enabled: !!deviceId,
    });

    // Sync React Query state to Zustand store
    useEffect(() => {
        if (data?.reports) {
            setReports(data.reports);
        }
        setLoading(isLoading);
        setError(error instanceof Error ? error : null);
    }, [data?.reports, isLoading, error, setReports, setLoading, setError]);

    return {
        reports: data?.reports ?? [],
        isLoading,
        error,
    };
};

