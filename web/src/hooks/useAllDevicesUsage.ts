import { useQuery } from '@tanstack/react-query';
import { useDevices } from './useDevices';
import { devicesApi, DeviceUsageReport } from '../api/devices';
import { useTimePeriodStore } from '../stores/timePeriodStore';

interface DeviceWithUsage {
    deviceId: string;
    deviceName: string;
    totalUsageMB: number;
    totalRxMB: number;
    totalTxMB: number;
    reportCount: number;
    lastReportDate: string | null;
}

interface AllDevicesStats {
    totalUsageMB: number;
    totalRxMB: number;
    totalTxMB: number;
    totalDevices: number;
    activeDevices: number;
    devicesWithUsage: DeviceWithUsage[];
    devicesSortedByUsage: DeviceWithUsage[];
}

export const useAllDevicesUsage = () => {
    const { devices } = useDevices();
    const { selectedPeriod, selectedCount } = useTimePeriodStore();

    const { data, isLoading, error } = useQuery({
        queryKey: ['allDevicesUsage', devices.map(d => d.id), selectedPeriod, selectedCount],
        queryFn: async () => {
            // Fetch usage for all active devices
            const activeDevices = devices.filter(d => d.status === 'active');
            const usagePromises = activeDevices.map(async (device) => {
                try {
                    const response = await devicesApi.getDeviceUsage(
                        device.id,
                        1000,
                        selectedPeriod ?? undefined,
                        selectedPeriod ? selectedCount : undefined
                    );
                    return {
                        deviceId: device.id,
                        deviceName: device.name,
                        reports: response.reports,
                    };
                } catch (err) {
                    console.error(`Failed to fetch usage for device ${device.id}:`, err);
                    return {
                        deviceId: device.id,
                        deviceName: device.name,
                        reports: [] as DeviceUsageReport[],
                    };
                }
            });

            const results = await Promise.all(usagePromises);

            // Helper function to convert bytes to MB
            const bytesToMB = (bytes: string): number => {
                return parseFloat(bytes) / (1024 * 1024);
            };

            // Calculate stats
            const devicesWithUsage: DeviceWithUsage[] = results.map((result) => {
                const totalRxMB = result.reports.reduce(
                    (sum, report) => {
                        const rxBytes = typeof report.totalRx === 'string' ? report.totalRx : String(report.totalRx);
                        return sum + bytesToMB(rxBytes);
                    },
                    0
                );
                const totalTxMB = result.reports.reduce(
                    (sum, report) => {
                        const txBytes = typeof report.totalTx === 'string' ? report.totalTx : String(report.totalTx);
                        return sum + bytesToMB(txBytes);
                    },
                    0
                );
                const totalUsageMB = totalRxMB + totalTxMB;

                const lastReport = result.reports.length > 0
                    ? new Date(result.reports[0].timestamp).toISOString().split('T')[0]
                    : null;

                return {
                    deviceId: result.deviceId,
                    deviceName: result.deviceName,
                    totalUsageMB,
                    totalRxMB,
                    totalTxMB,
                    reportCount: result.reports.length,
                    lastReportDate: lastReport,
                };
            });

            // Calculate totals
            const totalUsageMB = devicesWithUsage.reduce(
                (sum, d) => sum + d.totalUsageMB,
                0
            );
            const totalRxMB = devicesWithUsage.reduce(
                (sum, d) => sum + d.totalRxMB,
                0
            );
            const totalTxMB = devicesWithUsage.reduce(
                (sum, d) => sum + d.totalTxMB,
                0
            );

            // Sort devices by usage (descending)
            const devicesSortedByUsage = [...devicesWithUsage].sort(
                (a, b) => b.totalUsageMB - a.totalUsageMB
            );

            const stats: AllDevicesStats = {
                totalUsageMB,
                totalRxMB,
                totalTxMB,
                totalDevices: devices.length,
                activeDevices: activeDevices.length,
                devicesWithUsage,
                devicesSortedByUsage,
            };

            return stats;
        },
        enabled: devices.length > 0,
        refetchInterval: 30000, // Refetch every 30 seconds
    });

    return {
        stats: data,
        isLoading,
        error,
    };
};

