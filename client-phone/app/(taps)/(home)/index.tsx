import { Stack } from 'expo-router';
import { View, StyleSheet, FlatList, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppUsageCard } from '@/components/AppUsageCard';
import { TimePeriodSelector } from '@/components/TimePeriodSelector';
import { PermissionHandler } from '@/components/PermissionHandler';
import { TotalUsageHeader } from '@/components/TotalUsageHeader';
import { useNetworkUsage } from '@/hooks/useNetworkUsage';
import { ThemedView } from '@/components/themed-view';
import { TotalUsageHeaderSkeleton } from '@/components/TotalUsageHeaderSkeleton';
import { AppUsageCardSkeleton } from '@/components/AppUsageCardSkeleton';

export default function HomeScreen() {
    const [selectedPeriod, setSelectedPeriod] = useState('day');
    const [selectedCount, setSelectedCount] = useState(1);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [showToTop, setShowToTop] = useState(false);

    const listRef = useRef<FlatList<any>>(null);

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

    const showLoading = loading || isInitialLoad;

    const Header = () => (
        <View>
            {showLoading ? (
                <TotalUsageHeaderSkeleton />
            ) : (
                <TotalUsageHeader
                    totalUsage={totalUsage}
                    formatBytes={formatBytes}
                    period={selectedPeriod}
                    count={selectedCount}
                />
            )}
            <TimePeriodSelector
                selectedPeriod={selectedPeriod}
                selectedCount={selectedCount}
                onPeriodChange={handlePeriodChange}
                onCountChange={setSelectedCount}
            />
        </View>
    );

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

    const listData = showLoading ? Array.from({ length: 6 }, (_, i) => `skeleton-${i}`) : appUsages;

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        setShowToTop(y > 200);
    };

    const scrollToTop = () => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    return (
        <ThemedView style={styles.container}>
            <FlatList
                ref={listRef}
                data={listData as any}
                ListHeaderComponent={Header}
                renderItem={({ item }) => (
                    showLoading ? (
                        <AppUsageCardSkeleton />
                    ) : (
                        <AppUsageCard item={item} formatBytes={formatBytes} />
                    )
                )}
                keyExtractor={(item: any) => (typeof item === 'string' ? item : item.packageName)}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={!showLoading ? (
                    <View style={styles.emptyContainer}>
                        <ThemedText style={styles.emptyText}>
                            No network usage data found for the selected period.
                        </ThemedText>
                    </View>
                ) : null}
                onScroll={onScroll}
                scrollEventThrottle={16}
            />
            {showToTop && (
                <TouchableOpacity onPress={scrollToTop} style={styles.toTopButton} activeOpacity={0.9}>
                    <ThemedText style={styles.toTopText} lightColor="#fff" darkColor="#fff">↑</ThemedText>
                </TouchableOpacity>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 10,
        paddingBottom: 16,
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
    toTopButton: {
        position: 'absolute',
        right: 16,
        bottom: 24,
        backgroundColor: '#5355C4',
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    toTopText: {
        fontSize: 18,
        fontWeight: '700',
    },
});
