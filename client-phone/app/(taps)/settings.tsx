import { View, StyleSheet, Alert, Switch, NativeModules, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTheme, setTheme, subscribe } from '@/hooks/theme-store';
import React from 'react';
import { ThemedView } from '@/components/themed-view';

type UsageAccessPermissionType = {
    hasUsageAccess?: () => Promise<boolean>;
    openUsageAccessSettings?: () => void;
};

const { UsageAccessPermission } = NativeModules as { UsageAccessPermission?: UsageAccessPermissionType };

export default function SettingsScreen() {
    const systemScheme = useColorScheme();
    const [themeName, setThemeName] = React.useState(getTheme() ?? (systemScheme === 'dark' ? 'dark' : 'light'));

    React.useEffect(() => {
        const unsub = subscribe((t) => setThemeName(t));
        return unsub;
    }, []);

    const isDark = themeName === 'dark';

    const onToggleTheme = (value: boolean) => {
        setTheme(value ? 'dark' : 'light');
    };

    const checkPermission = async () => {
        try {
            if (!UsageAccessPermission?.hasUsageAccess) {
                Alert.alert('Unavailable', 'Permission module is not available on this platform.');
                return;
            }
            const granted = await UsageAccessPermission.hasUsageAccess();
            Alert.alert('Usage Access', granted ? 'Permission is granted.' : 'Permission is NOT granted.');
        } catch {
            Alert.alert('Error', 'Failed to check permission status');
        }
    };

    const openUsageSettings = async () => {
        try {
            if (!UsageAccessPermission?.openUsageAccessSettings) {
                Alert.alert('Unavailable', 'Cannot open settings on this platform.');
                return;
            }
            UsageAccessPermission.openUsageAccessSettings();
        } catch {
            Alert.alert('Error', 'Failed to open settings');
        }
    };

    return (
        <ThemedView style={styles.container}>

            <ThemedView style={styles.sectionCard}>
                <ThemedText type="subtitle">Theme</ThemedText>
                <View style={styles.row}>
                    <ThemedText>Light</ThemedText>
                    <Switch
                        value={isDark}
                        onValueChange={onToggleTheme}
                        trackColor={{ false: isDark ? '#3a3a3a' : '#cfcfcf', true: '#5355C4' }}
                        thumbColor={isDark ? '#ffffff' : '#ffffff'}
                        ios_backgroundColor={isDark ? '#3a3a3a' : '#cfcfcf'}
                    />
                    <ThemedText>Dark</ThemedText>
                </View>
            </ThemedView>

            <ThemedView style={styles.sectionCard}>
                <ThemedText type="subtitle">Permissions</ThemedText>
                <View style={styles.col}>
                    <TouchableOpacity activeOpacity={0.9} style={styles.primaryButton} onPress={checkPermission}>
                        <ThemedText style={styles.primaryButtonText} darkColor="#fff" lightColor="#fff">Check Permission</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.9} style={styles.primaryButton} onPress={openUsageSettings}>
                        <ThemedText style={styles.primaryButtonText} darkColor="#fff" lightColor="#fff">Open Usage Settings</ThemedText>
                    </TouchableOpacity>
                </View>
            </ThemedView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        padding: 16,
        gap: 16,
    },
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'center',
    },
    col: {
        gap: 12,
    },
    primaryButton: {
        backgroundColor: '#5355C4',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
