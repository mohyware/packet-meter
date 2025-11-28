import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/Button';
import { ThemedView } from '@/components/themed-view';

type DeviceTokenCardProps = {
  isLoadingToken: boolean;
  tokenPreview: string | null;
  onScanPress: () => void;
};

export function DeviceTokenCard({
  isLoadingToken,
  tokenPreview,
  onScanPress,
}: DeviceTokenCardProps) {
  return (
    <ThemedView style={styles.sectionCard}>
      <View style={styles.col}>
        <Button
          title="Add Device Token (QR Code)"
          onPress={onScanPress}
          disabled={false}
          variant="primary"
        />
        <ThemedText
          style={styles.helperText}
          lightColor="#333333"
          darkColor="#dddddd"
        >
          {isLoadingToken
            ? 'Loading saved token...'
            : tokenPreview
              ? `There is currently a saved token.`
              : 'No device token saved yet.'}
        </ThemedText>
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
  helperText: {
    fontSize: 12,
  },
});
