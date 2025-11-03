import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { Skeleton } from '@/components/Skeleton';

export function AppUsageCardSkeleton() {
    return (
        <ThemedView style={styles.card}>
            <View style={styles.row}>
                <View style={styles.icon} />
                <View style={styles.flex}>
                    <Skeleton width={160} height={14} />
                    <View style={{ height: 6 }} />
                    <Skeleton width={120} height={12} />
                </View>
                <Skeleton width={60} height={14} />
            </View>
            <View style={{ height: 40 }} />
            <Skeleton width={'100%'} height={12} />
            <View style={{ height: 20 }} />
            <Skeleton width={'90%'} height={12} />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 10,
        padding: 15,
        marginVertical: 5,
        marginHorizontal: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
        elevation: 3,
        height: 160,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#7b7b7b33',
        marginRight: 12,
    },
    flex: { flex: 1 },
});
