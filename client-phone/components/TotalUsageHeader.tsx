import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { TotalNetworkData } from '@/hooks/useNetworkUsage';

interface TotalUsageHeaderProps {
    totalUsage: TotalNetworkData | null;
    formatBytes: (bytes: number) => string;
    period: string;
    count: number;
}

export function TotalUsageHeader({ totalUsage, formatBytes, period, count }: TotalUsageHeaderProps) {
    if (!totalUsage) {
        return (
            <View style={styles.container}>
                <ThemedText type="title" style={styles.title}>PacketPilot</ThemedText>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ThemedText type="title" style={styles.title}>PacketPilot</ThemedText>
            <View style={styles.usageContainer}>
                <ThemedText style={styles.periodText}>
                    Last {count} {period}{count > 1 ? 's' : ''}
                </ThemedText>
                <View style={styles.statsContainer}>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Wi-Fi:</Text>
                        <Text style={styles.statValue}>
                            ↓{formatBytes(totalUsage.wifi.rx)} ↑{formatBytes(totalUsage.wifi.tx)} = {formatBytes(totalUsage.wifi.total)}
                        </Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Mobile:</Text>
                        <Text style={styles.statValue}>
                            ↓{formatBytes(totalUsage.mobile.rx)} ↑{formatBytes(totalUsage.mobile.tx)} = {formatBytes(totalUsage.mobile.total)}
                        </Text>
                    </View>
                    <View style={[styles.statRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>
                            {formatBytes(totalUsage.totalBytes)}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    title: {
        color: '#09090B',
    },
    usageContainer: {
        marginTop: 10,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
        elevation: 3,
    },
    periodText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
        textAlign: 'center',
    },
    statsContainer: {
        gap: 4,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
        flex: 1,
    },
    statValue: {
        fontSize: 12,
        color: '#333',
        fontWeight: '500',
        flex: 2,
        textAlign: 'right',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 8,
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 14,
        color: '#333',
        fontWeight: 'bold',
    },
    totalValue: {
        fontSize: 14,
        color: '#f4511e',
        fontWeight: 'bold',
    },
});
