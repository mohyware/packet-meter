import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { NativeModules } from 'react-native';

const { NetworkUsage, UsageAccessPermission } = NativeModules;

export interface AppNetworkData {
    packageName: string;
    appName: string;
    icon: string;
    uid: number;
    wifi: {
        rx: number;
        tx: number;
        total: number;
    };
    mobile: {
        rx: number;
        tx: number;
        total: number;
    };
    totalBytes: number;
}

export interface TotalNetworkData {
    wifi: {
        rx: number;
        tx: number;
        total: number;
    };
    mobile: {
        rx: number;
        tx: number;
        total: number;
    };
    totalBytes: number;
}

export function useNetworkUsage() {
    const [appUsages, setAppUsages] = useState<AppNetworkData[]>([]);
    const [totalUsage, setTotalUsage] = useState<TotalNetworkData | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    const checkPermission = useCallback(async () => {
        try {
            const granted = await UsageAccessPermission.hasUsageAccess();
            setHasPermission(granted);
            return granted;
        } catch (error) {
            console.error('Error checking permission:', error);
            setHasPermission(false);
            return false;
        }
    }, []);

    const getAppNetworkUsage = useCallback(async (period: string, count: number) => {
        setLoading(true);
        try {
            const usage = JSON.parse(await NetworkUsage.getAppNetworkUsage(period, count));
            setAppUsages(usage);
            console.log('App network usage:', usage);
            return usage;
        } catch (e) {
            console.error('Error getting app network usage:', e);
            const errorMessage = (e as Error).message || 'Failed to get app network usage';

            if (errorMessage.includes('permission') || errorMessage.includes('access')) {
                Alert.alert(
                    "Permission Required",
                    "This app needs usage access permission to monitor network usage. Please enable it in settings.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: openUsageSettings }
                    ]
                );
            } else {
                Alert.alert('Error', errorMessage);
            }
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getTotalNetworkUsage = useCallback(async (period: string, count: number) => {
        try {
            const usage = JSON.parse(await NetworkUsage.getTotalNetworkUsage(period, count));
            setTotalUsage(usage);
            console.log('Total network usage:', usage);
            return usage;
        } catch (e) {
            console.error('Error getting total network usage:', e);
            return null;
        }
    }, []);

    const openUsageSettings = useCallback(async () => {
        try {
            UsageAccessPermission.openUsageAccessSettings();
        } catch (error) {
            console.error('Error opening settings:', error);
            Alert.alert("Error", "Failed to open settings");
        }
    }, []);

    const formatBytes = useCallback((bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }, []);

    return {
        appUsages,
        totalUsage,
        loading,
        hasPermission,
        checkPermission,
        getAppNetworkUsage,
        getTotalNetworkUsage,
        openUsageSettings,
        formatBytes,
    };
}
