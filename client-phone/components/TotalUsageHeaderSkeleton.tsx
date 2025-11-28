import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { Skeleton } from '@/components/Skeleton';

export function TotalUsageHeaderSkeleton() {
  return (
    <View style={styles.container}>
      <ThemedView style={styles.card}>
        <Skeleton width={100} height={14} style={{ alignSelf: 'center' }} />
        <View style={{ height: 22 }} />
        <View style={styles.row}>
          <View style={{ width: 60 }}>
            <Skeleton width={60} height={14} />
          </View>
          <View style={{ width: 220, alignItems: 'flex-end' }}>
            <Skeleton width={160} height={14} />
          </View>
        </View>
        <View style={{ height: 18 }} />
        <View style={styles.row}>
          <View style={{ width: 60 }}>
            <Skeleton width={60} height={12} />
          </View>
          <View style={{ width: 220, alignItems: 'flex-end' }}>
            <Skeleton width={160} height={12} />
          </View>
        </View>
        <View style={{ height: 36 }} />
        <View style={styles.row}>
          <View style={{ width: 60 }}>
            <Skeleton width={60} height={14} />
          </View>
          <View style={{ width: 50, alignItems: 'flex-end' }}>
            <Skeleton width={50} height={14} />
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
  card: {
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
    marginTop: 10,
    height: 160,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
