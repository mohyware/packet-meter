import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface AppNetworkData {
    packageName: string;
    appName: string;
    icon: string | null;
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

interface AppUsageCardProps {
    item: AppNetworkData;
    formatBytes: (bytes: number) => string;
}

export function AppUsageCard({ item, formatBytes }: AppUsageCardProps) {
    return (
        <ThemedView style={styles.appItem} lightColor="#f5f5f5" darkColor="#1f2123">
            <View style={styles.appHeader}>
                {item.icon && (
                    <Image source={{ uri: item.icon }} style={styles.appIcon} />
                )}
                <View style={styles.appInfo}>
                    <ThemedText style={styles.appName}>{item.appName}</ThemedText>
                    <ThemedText style={styles.packageName}>{item.packageName}</ThemedText>
                </View>
                <ThemedText style={styles.totalUsage}>{formatBytes(item.totalBytes)}</ThemedText>
            </View>
            <View style={styles.usageDetails}>
                <View style={styles.usageRow}>
                    <ThemedText style={styles.usageLabel}>
                        Wi-Fi: ↓{formatBytes(item.wifi.rx)} ↑{formatBytes(item.wifi.tx)} = {formatBytes(item.wifi.total)}
                    </ThemedText>
                </View>
                <View style={styles.usageRow}>
                    <ThemedText style={styles.usageLabel}>
                        Mobile: ↓{formatBytes(item.mobile.rx)} ↑{formatBytes(item.mobile.tx)} = {formatBytes(item.mobile.total)}
                    </ThemedText>
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    appItem: {
        borderRadius: 10,
        padding: 15,
        marginVertical: 5,
        marginHorizontal: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
        elevation: 3,
    },
    appHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    appIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 12,
    },
    appInfo: {
        flex: 1,
    },
    appName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    packageName: {
        fontSize: 12,
        marginTop: 2,
        opacity: 0.7,
    },
    totalUsage: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#5355C4',
    },
    usageDetails: {
        marginTop: 5,
    },
    usageRow: {
        marginVertical: 3,
    },
    usageLabel: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'left',
        opacity: 0.8,
    },
});
