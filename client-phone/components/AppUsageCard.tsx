import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface AppNetworkData {
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

interface AppUsageCardProps {
    item: AppNetworkData;
    formatBytes: (bytes: number) => string;
}

export function AppUsageCard({ item, formatBytes }: AppUsageCardProps) {
    return (
        <View style={styles.appItem}>
            <View style={styles.appHeader}>
                {item.icon && (
                    <Image source={{ uri: item.icon }} style={styles.appIcon} />
                )}
                <View style={styles.appInfo}>
                    <Text style={styles.appName}>{item.appName}</Text>
                    <Text style={styles.packageName}>{item.packageName}</Text>
                </View>
                <Text style={styles.totalUsage}>{formatBytes(item.totalBytes)}</Text>
            </View>
            <View style={styles.usageDetails}>
                <View style={styles.usageRow}>
                    <Text style={styles.usageLabel}>
                        Wi-Fi: ↓{formatBytes(item.wifi.rx)} ↑{formatBytes(item.wifi.tx)} = {formatBytes(item.wifi.total)}
                    </Text>
                </View>
                <View style={styles.usageRow}>
                    <Text style={styles.usageLabel}>
                        Mobile: ↓{formatBytes(item.mobile.rx)} ↑{formatBytes(item.mobile.tx)} = {formatBytes(item.mobile.total)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    appItem: {
        backgroundColor: '#f5f5f5',
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
        color: '#333',
    },
    packageName: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    totalUsage: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#f4511e',
    },
    usageDetails: {
        marginTop: 5,
    },
    usageRow: {
        marginVertical: 3,
    },
    usageLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
        textAlign: 'left',
    },
});
