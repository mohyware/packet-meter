import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/Button';
import { useNetworkUsage } from '@/hooks/useNetworkUsage';
import { useCameraPermissions } from 'expo-camera';

export function PermissionsCard() {
    const {
        checkPermission: usagePermissionCheck,
        openUsageSettings,
    } = useNetworkUsage();

    const [cameraPermission] = useCameraPermissions();

    const CameraPermissionCheck = async () => {
        if (cameraPermission?.granted) {
            Alert.alert('Camera Access', 'Permission is granted.');
        } else {
            Alert.alert('Camera Access', 'Permission is NOT granted.');
        }
    };

    const UsagePermissionCheck = async () => {
        try {
            const granted = await usagePermissionCheck();
            Alert.alert('Usage Access', granted ? 'Permission is granted.' : 'Permission is NOT granted.');
        } catch {
            Alert.alert('Error', 'Failed to check permission status');
        }
    };

    const handleOpenUsageSettings = async () => {
        try {
            await openUsageSettings();
        } catch {
            Alert.alert('Error', 'Failed to open settings');
        }
    };

    return (
        <View style={styles.sectionCard}>
            <ThemedText type="subtitle">Permissions</ThemedText>
            <View style={styles.col}>
                <Button
                    title="Check Usage Permission"
                    onPress={UsagePermissionCheck}
                    disabled={false}
                    variant="primary"
                />
                <Button
                    title="Check Camera Permission"
                    onPress={CameraPermissionCheck}
                    disabled={false}
                    variant="primary"
                />
                <Button
                    title="Open Usage Settings"
                    onPress={handleOpenUsageSettings}
                    disabled={false}
                    variant="primary"
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionCard: {
        borderRadius: 10,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
        elevation: 3,
        gap: 12,
    },
    col: {
        gap: 12,
    },
});


