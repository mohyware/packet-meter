import React from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import { NativeModules } from 'react-native';

const { UsageAccessPermission } = NativeModules;

interface PermissionHandlerProps {
    onPermissionGranted: () => void;
    onRetry: () => void;
}

export function PermissionHandler({ onPermissionGranted, onRetry }: PermissionHandlerProps) {
    const checkPermission = async () => {
        try {
            const granted = await UsageAccessPermission.hasUsageAccess();
            if (granted) {
                onPermissionGranted();
            } else {
                Alert.alert(
                    "Permission Required",
                    "This app needs usage access permission to monitor network usage. Please enable it in settings.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: openUsageSettings }
                    ]
                );
            }
        } catch (error) {
            console.error('Error checking permission:', error);
            Alert.alert("Error", "Failed to check permission status");
        }
    };

    const openUsageSettings = async () => {
        try {
            UsageAccessPermission.openUsageAccessSettings();
        } catch (error) {
            console.error('Error opening settings:', error);
            Alert.alert("Error", "Failed to open settings");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Permission Required</Text>
            <Text style={styles.description}>
                This app needs usage access permission to monitor network usage for each app.
                Please grant the permission to continue.
            </Text>
            <View style={styles.buttonContainer}>
                <Button title="Check Permission" onPress={checkPermission} />
                <View style={styles.spacing} />
                <Button title="Open Settings" onPress={openUsageSettings} />
                <View style={styles.spacing} />
                <Button title="Retry" onPress={onRetry} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    buttonContainer: {
        width: '100%',
    },
    spacing: {
        height: 10,
    },
});
