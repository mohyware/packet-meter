import React from 'react';
import {
  View,
  Alert,
  StyleSheet,
  NativeModules,
  TouchableOpacity,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const { UsageAccessPermission } = NativeModules as {
  UsageAccessPermission: {
    hasUsageAccess: () => Promise<boolean>;
    openUsageAccessSettings: () => void;
  };
};

interface PermissionHandlerProps {
  onPermissionGranted: () => void;
  onRetry: () => void;
}

export function PermissionHandler({
  onPermissionGranted,
  onRetry,
}: PermissionHandlerProps) {
  const checkPermission = async () => {
    try {
      const granted = await UsageAccessPermission?.hasUsageAccess?.();
      if (granted) {
        onPermissionGranted();
      } else {
        Alert.alert(
          'Permission Required',
          'This app needs usage access permission to monitor network usage. Please enable it in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openUsageSettings },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking permission:', error);
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
    } catch (error) {
      console.error('Error opening settings:', error);
      Alert.alert('Error', 'Failed to open settings');
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <ThemedView style={styles.card}>
        <ThemedText type="subtitle" style={styles.title}>
          Permission Required
        </ThemedText>
        <ThemedText style={styles.description}>
          This app needs usage access permission to monitor network usage for
          each app. Please grant the permission to continue.
        </ThemedText>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={checkPermission}
            activeOpacity={0.9}
          >
            <ThemedText
              style={styles.primaryButtonText}
              lightColor="#fff"
              darkColor="#fff"
            >
              Check Permission
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={onRetry}
            activeOpacity={0.9}
          >
            <ThemedText style={styles.outlineButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: 16,
  },
  card: {
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.9,
  },
  buttons: {
    gap: 12,
    marginTop: 8,
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
  outlineButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5355C4',
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5355C4',
  },
});
