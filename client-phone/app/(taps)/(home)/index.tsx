import { Stack } from 'expo-router';
import { View, StyleSheet, FlatList } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback } from 'react';
import { AppUsageCard } from '@/components/AppUsageCard';
import { TimePeriodSelector } from '@/components/TimePeriodSelector';
import { PermissionHandler } from '@/components/PermissionHandler';
import { TotalUsageHeader } from '@/components/TotalUsageHeader';
import { useNetworkUsage } from '@/hooks/useNetworkUsage';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
    const [selectedPeriod, setSelectedPeriod] = useState('day');
    const [selectedCount, setSelectedCount] = useState(1);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const {
        appUsages,
        totalUsage,
        loading,
        hasPermission,
        checkPermission,
        getAppNetworkUsage,
        getTotalNetworkUsage,
        formatBytes,
    } = useNetworkUsage();

    // Auto-load on app open
    useEffect(() => {
        const initializeApp = async () => {
            const hasAccess = await checkPermission();
            if (hasAccess) {
                await Promise.all([
                    getAppNetworkUsage(selectedPeriod, selectedCount),
                    getTotalNetworkUsage(selectedPeriod, selectedCount)
                ]);
            }
            setIsInitialLoad(false);
        };

        initializeApp();
    }, [checkPermission, getAppNetworkUsage, getTotalNetworkUsage, selectedPeriod, selectedCount]);

    // Reload when period or count changes
    useEffect(() => {
        if (!isInitialLoad && hasPermission) {
            Promise.all([
                getAppNetworkUsage(selectedPeriod, selectedCount),
                getTotalNetworkUsage(selectedPeriod, selectedCount)
            ]);
        }
    }, [selectedPeriod, selectedCount, isInitialLoad, hasPermission, getAppNetworkUsage, getTotalNetworkUsage]);

    const handlePeriodChange = useCallback((period: string) => {
        setSelectedPeriod(period);
        if (period === 'month') {
            setSelectedCount(1);
        } else if (selectedCount > 7) {
            setSelectedCount(7);
        }
    }, [selectedCount]);

    const handlePermissionGranted = useCallback(async () => {
        await Promise.all([
            getAppNetworkUsage(selectedPeriod, selectedCount),
            getTotalNetworkUsage(selectedPeriod, selectedCount)
        ]);
    }, [getAppNetworkUsage, getTotalNetworkUsage, selectedPeriod, selectedCount]);

    const handleRetry = useCallback(async () => {
        const hasAccess = await checkPermission();
        if (hasAccess) {
            await Promise.all([
                getAppNetworkUsage(selectedPeriod, selectedCount),
                getTotalNetworkUsage(selectedPeriod, selectedCount)
            ]);
        }
    }, [checkPermission, getAppNetworkUsage, getTotalNetworkUsage, selectedPeriod, selectedCount]);

    // Show permission handler if permission is not granted
    if (hasPermission === false) {
        return (
            <ThemedView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <PermissionHandler
                    onPermissionGranted={handlePermissionGranted}
                    onRetry={handleRetry}
                />
            </ThemedView>
        );
    }

    // Show loading screen during initial load
    if (isInitialLoad) {
        return (
            <ThemedView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <ThemedText type="title">Loading...</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            {/* <Stack.Screen options={{ headerShown: false }} /> */}

            <TotalUsageHeader
                totalUsage={totalUsage}
                formatBytes={formatBytes}
                period={selectedPeriod}
                count={selectedCount}
            />

            <TimePeriodSelector
                selectedPeriod={selectedPeriod}
                selectedCount={selectedCount}
                onPeriodChange={handlePeriodChange}
                onCountChange={setSelectedCount}
            />

            {loading && (
                <ThemedText style={styles.loadingText}>Loading network usage...</ThemedText>
            )}

            {appUsages.length > 0 && (
                <View style={styles.appListContainer}>
                    <ThemedText type="subtitle" style={styles.subtitle}>
                        App Network Usage (Last {selectedCount} {selectedPeriod}{selectedCount > 1 ? 's' : ''})
                    </ThemedText>
                    <FlatList
                        data={appUsages}
                        renderItem={({ item }) => (
                            <AppUsageCard item={item} formatBytes={formatBytes} />
                        )}
                        keyExtractor={(item) => item.packageName}
                        style={styles.appList}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            )}

            {!loading && appUsages.length === 0 && hasPermission && (
                <View style={styles.emptyContainer}>
                    <ThemedText style={styles.emptyText}>
                        No network usage data found for the selected period.
                    </ThemedText>
                </View>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    appListContainer: {
        flex: 1,
        paddingHorizontal: 10,
    },
    appList: {
        flex: 1,
    },
    subtitle: {},
    loadingText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 16,
    },
});
