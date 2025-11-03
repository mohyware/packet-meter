import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { TotalNetworkData } from '@/hooks/useNetworkUsage';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

interface TotalUsageHeaderProps {
    totalUsage: TotalNetworkData | null;
    formatBytes: (bytes: number) => string;
    period: string;
    count: number;
}

export function TotalUsageHeader({ totalUsage, formatBytes, period, count }: TotalUsageHeaderProps) {
    const borderColor = useThemeColor({ light: '#eee', dark: '#2a2d2e' }, 'icon');

    if (!totalUsage) {
        return (
            <View style={styles.container}>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ThemedView style={[styles.usageContainer, { borderTopColor: borderColor }]}>
                <ThemedText style={styles.periodText}>
                    Last {count} {period}{count > 1 ? 's' : ''}
                </ThemedText>
                <View style={styles.statsContainer}>
                    <View style={styles.statRow}>
                        <ThemedText style={styles.statLabel}>Wi-Fi:</ThemedText>
                        <ThemedText style={styles.statValue}>
                            ↓{formatBytes(totalUsage.wifi.rx)} ↑{formatBytes(totalUsage.wifi.tx)} = {formatBytes(totalUsage.wifi.total)}
                        </ThemedText>
                    </View>
                    <View style={styles.statRow}>
                        <ThemedText style={styles.statLabel}>Mobile:</ThemedText>
                        <ThemedText style={styles.statValue}>
                            ↓{formatBytes(totalUsage.mobile.rx)} ↑{formatBytes(totalUsage.mobile.tx)} = {formatBytes(totalUsage.mobile.total)}
                        </ThemedText>
                    </View>
                    <View style={[styles.statRow, styles.totalRow, { borderTopColor: borderColor }]}>
                        <ThemedText style={styles.totalLabel}>Total:</ThemedText>
                        <ThemedText style={styles.totalValue}>
                            {formatBytes(totalUsage.totalBytes)}
                        </ThemedText>
                    </View>
                </View>
            </ThemedView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    usageContainer: {
        marginTop: 10,
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
        fontWeight: '500',
        flex: 1,
    },
    statValue: {
        fontSize: 12,
        fontWeight: '500',
        flex: 2,
        textAlign: 'right',
    },
    totalRow: {
        borderTopWidth: 1,
        paddingTop: 8,
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    totalValue: {
        fontSize: 14,
        color: '#5355C4',
        fontWeight: 'bold',
    },
});
