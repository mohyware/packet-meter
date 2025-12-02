import React from 'react';
import {
  startBackgroundActions,
  stopBackgroundActions,
  isBackgroundActionsRunning,
} from '@/services/backgroundActions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { View, StyleSheet, Alert } from 'react-native';
import { Button } from '@/components/Button';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export function BackgroundServiceCard() {
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [action, setAction] = React.useState<'start' | 'stop' | null>(null);

  const checkStatus = React.useCallback(async () => {
    try {
      const running = await isBackgroundActionsRunning();
      setIsRunning(running);
    } catch (err) {
      console.error('Failed to check background service status:', err);
    }
  }, []);

  React.useEffect(() => {
    checkStatus();
    // Check status every 2 seconds when component is mounted
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleStartService = async () => {
    if (action || isLoading) return;
    setAction('start');
    setIsLoading(true);
    try {
      await startBackgroundActions(15);
      await checkStatus();
      Alert.alert(
        'Background Service',
        'Background service started successfully. Reports will be sent every 15 minutes.'
      );
    } catch (err) {
      console.error('Failed to start background service:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to start background service. Please try again.';
      Alert.alert('Background Service', errorMessage);
    } finally {
      setIsLoading(false);
      setAction(null);
    }
  };

  const handleStopService = async () => {
    if (action || isLoading) return;
    setAction('stop');
    setIsLoading(true);
    try {
      await stopBackgroundActions();
      await checkStatus();
      Alert.alert(
        'Background Service',
        'Background service stopped successfully.'
      );
    } catch (err) {
      console.error('Failed to stop background service:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to stop background service. Please try again.';
      Alert.alert('Background Service', errorMessage);
    } finally {
      setIsLoading(false);
      setAction(null);
    }
  };

  return (
    <ThemedView style={styles.sectionCard}>
      <ThemedText type="subtitle">Background Service</ThemedText>
      <View style={styles.statusRow}>
        <ThemedText style={styles.statusLabel}>Status:</ThemedText>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isRunning ? '#10b981' : '#6b7280' },
          ]}
        >
          <ThemedText
            style={styles.statusBadgeText}
            lightColor="#fff"
            darkColor="#fff"
          >
            {isRunning ? 'Running' : 'Stopped'}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={styles.description}>
        {isRunning
          ? 'Background service is actively sending reports every 15 minutes.'
          : 'Background service is stopped. Start it to enable automatic reporting.'}
      </ThemedText>
      <View style={styles.col}>
        <Button
          title={
            action === 'start'
              ? 'Starting service…'
              : 'Start Background Service'
          }
          icon={<MaterialIcons name="play-arrow" size={24} color="white" />}
          onPress={handleStartService}
          disabled={isLoading || isRunning}
        />
        <Button
          title={
            action === 'stop' ? 'Stopping service…' : 'Stop Background Service'
          }
          icon={
            <MaterialCommunityIcons
              name="stop-circle"
              size={24}
              color="white"
            />
          }
          onPress={handleStopService}
          disabled={isLoading || !isRunning}
        />
      </View>
    </ThemedView>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
});
