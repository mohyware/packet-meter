import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  apiCheckPermission,
  apiGetAppUsage,
  apiGetTotalUsage,
  apiOpenUsageSettings,
} from '@/services/networkUsageAPI';
import { AppUsageDataAPI, TotalUsageDataAPI } from '@/types/networkUsage';

export function useNetworkUsage() {
  const [appUsages, setAppUsages] = useState<AppUsageDataAPI[]>([]);
  const [totalUsage, setTotalUsage] = useState<TotalUsageDataAPI | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const checkPermission = useCallback(async () => {
    try {
      const granted = await apiCheckPermission();
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Error checking permission:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const openUsageSettings = useCallback(async () => {
    try {
      await apiOpenUsageSettings();
    } catch (error) {
      console.error('Error opening settings:', error);
      Alert.alert('Error', 'Failed to open settings');
    }
  }, []);

  const getAppNetworkUsage = useCallback(
    async (period: string, count: number, detailed: boolean = false) => {
      setLoading(true);
      try {
        const usage = await apiGetAppUsage(period, count, detailed);
        setAppUsages(usage);
        return usage;
      } catch (e) {
        console.error('Error getting app network usage:', e);
        const errorMessage =
          (e as Error).message || 'Failed to get app network usage';

        if (
          errorMessage.includes('permission') ||
          errorMessage.includes('access')
        ) {
          Alert.alert(
            'Permission Required',
            'This app needs usage access permission to monitor network usage. Please enable it in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: openUsageSettings },
            ]
          );
        } else {
          Alert.alert('Error', errorMessage);
        }
        return [];
      } finally {
        setLoading(false);
      }
    },
    [openUsageSettings]
  );

  const getTotalNetworkUsage = useCallback(
    async (period: string, count: number) => {
      try {
        const usage = await apiGetTotalUsage(period, count);
        setTotalUsage(usage);
        return usage;
      } catch (e) {
        console.error('Error getting total network usage:', e);
        return null;
      }
    },
    []
  );

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
