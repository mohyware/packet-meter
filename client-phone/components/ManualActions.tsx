import React from 'react';
import {
  healthCheck,
  reportPerProcessUsage,
  reportTotalUsage,
} from '@/services/reporting';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { View, StyleSheet, Alert } from 'react-native';
import { Button } from '@/components/Button';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AntDesign from '@expo/vector-icons/AntDesign';

export function ManualActions() {
  const [manualAction, setManualAction] = React.useState<
    null | 'health' | 'total' | 'per'
  >(null);
  const manualActionInFlight = manualAction !== null;

  const handleManualHealthCheck = async () => {
    if (manualAction) return;
    setManualAction('health');
    try {
      const result = await healthCheck();
      Alert.alert(
        'Health Check',
        result.ok
          ? 'Server responded successfully.'
          : result.error ||
              'Health check failed. Please verify the server details.'
      );
    } catch (err) {
      console.error('Manual health check failed', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unexpected error occurred. Please try again.';
      Alert.alert('Health Check', errorMessage);
    } finally {
      setManualAction(null);
    }
  };

  const handleManualTotalReport = async () => {
    if (manualAction) return;
    setManualAction('total');
    try {
      const result = await reportTotalUsage();
      Alert.alert(
        'Report Total Usage',
        result.ok
          ? 'Report sent successfully.'
          : result.error || 'Failed to send total usage report.'
      );
    } catch (err) {
      console.error('Manual total usage report failed', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unexpected error occurred. Please try again.';
      Alert.alert('Report Total Usage', errorMessage);
    } finally {
      setManualAction(null);
    }
  };

  const handleManualPerProcessReport = async () => {
    if (manualAction) return;
    setManualAction('per');
    try {
      const result = await reportPerProcessUsage();
      Alert.alert(
        'Report Per App Usage',
        result.ok
          ? 'Per-app report sent successfully.'
          : result.error || 'Failed to send per-app usage report.'
      );
    } catch (err) {
      console.error('Manual per-app usage report failed', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unexpected error occurred. Please try again.';
      Alert.alert('Report Per App Usage', errorMessage);
    } finally {
      setManualAction(null);
    }
  };

  return (
    <ThemedView style={styles.sectionCard}>
      <ThemedText type="subtitle">Manual Reporter Actions</ThemedText>
      <View style={styles.col}>
        <Button
          title={
            manualAction === 'health'
              ? 'Running health check…'
              : 'Send Health Check'
          }
          icon={
            <MaterialIcons name="health-and-safety" size={24} color="white" />
          }
          onPress={handleManualHealthCheck}
          disabled={manualActionInFlight}
        />
        <Button
          title={
            manualAction === 'total'
              ? 'Reporting total usage…'
              : 'Report Total Usage'
          }
          icon={
            <MaterialCommunityIcons name="chart-box" size={24} color="white" />
          }
          onPress={handleManualTotalReport}
          disabled={manualActionInFlight}
        />
        <Button
          title={
            manualAction === 'per'
              ? 'Reporting per-app usage…'
              : 'Report Per-App Usage'
          }
          icon={<AntDesign name="appstore" size={24} color="white" />}
          onPress={handleManualPerProcessReport}
          disabled={manualActionInFlight}
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
});
