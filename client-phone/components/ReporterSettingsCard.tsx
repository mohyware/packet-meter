import React from 'react';
import {
  View,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/Button';
import type { ReportMode } from '@/types/reports';
import { ThemedView } from '@/components/themed-view';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MODE_LABELS: Record<ReportMode, { title: string }> = {
  total: {
    title: 'Total Usage',
  },
  'per-process': {
    title: 'Per Process',
  },
};

type ReporterSettingsCardProps = {
  serverHost: string;
  serverPort: string;
  useTls: boolean;
  reportMode: ReportMode;
  targetMode: 'cloud' | 'custom';
  canSave: boolean;
  isSaving: boolean;
  onChangeHost: (value: string) => void;
  onChangePort: (value: string) => void;
  onToggleTls: (value: boolean) => void;
  onSelectMode: (mode: ReportMode) => void;
  onChangeTargetMode: (mode: 'cloud' | 'custom') => void;
  onSave: () => void;
};

export function ReporterSettingsCard({
  serverHost,
  serverPort,
  useTls,
  reportMode,
  targetMode,
  canSave,
  isSaving,
  onChangeHost,
  onChangePort,
  onToggleTls,
  onSelectMode,
  onChangeTargetMode,
  onSave,
}: ReporterSettingsCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ThemedView style={styles.sectionCard}>
      <ThemedText type="subtitle">Reporter Settings</ThemedText>

      <View style={[styles.row, styles.justifyBetween]}>
        <View style={styles.modeRow}>
          {(['cloud', 'custom'] as const).map((mode) => {
            const active = targetMode === mode;
            const iconColor = active ? 'white' : isDark ? 'white' : 'black';
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.modeOption, active && styles.modeOptionActive]}
                onPress={() => onChangeTargetMode(mode)}
                activeOpacity={0.9}
              >
                {mode === 'cloud' ? (
                  <AntDesign name="cloud-server" size={20} color={iconColor} />
                ) : (
                  <Feather name="server" size={20} color={iconColor} />
                )}
                <ThemedText
                  style={[
                    styles.modeOptionTitle,
                    active && styles.modeOptionTitleActive,
                  ]}
                  darkColor={active ? '#fff' : undefined}
                  lightColor={active ? '#fff' : undefined}
                >
                  {mode === 'cloud' ? 'Our Cloud' : 'Custom'}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {targetMode === 'custom' && (
        <>
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Server Host</ThemedText>
            <TextInput
              style={styles.textInput}
              value={serverHost}
              onChangeText={onChangeHost}
              placeholder="localhost"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Server Port</ThemedText>
            <TextInput
              style={styles.textInput}
              value={serverPort}
              onChangeText={onChangePort}
              placeholder="8080"
              keyboardType="numeric"
            />
          </View>
        </>
      )}

      {targetMode === 'custom' && (
        <View style={[styles.row, styles.justifyBetween]}>
          <ThemedText>Use HTTPS</ThemedText>
          <Switch
            value={useTls}
            onValueChange={onToggleTls}
            trackColor={{ false: '#cfcfcf', true: '#5355C4' }}
            thumbColor="#ffffff"
          />
        </View>
      )}

      <View style={styles.modeRow}>
        {(['total', 'per-process'] as ReportMode[]).map((mode) => {
          const active = reportMode === mode;
          const meta = MODE_LABELS[mode];
          return (
            <TouchableOpacity
              key={mode}
              style={[styles.modeOption, active && styles.modeOptionActive]}
              onPress={() => onSelectMode(mode)}
              activeOpacity={0.9}
            >
              <ThemedText
                style={[
                  styles.modeOptionTitle,
                  active && styles.modeOptionTitleActive,
                ]}
                darkColor={active ? '#fff' : undefined}
                lightColor={active ? '#fff' : undefined}
              >
                {meta.title}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      <Button
        title={isSaving ? 'Saving…' : 'Save Settings'}
        onPress={onSave}
        disabled={!canSave || isSaving}
        variant="primary"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2.22,
    elevation: 3,
    gap: 12,
  },
  fieldGroup: {
    width: '100%',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  justifyBetween: {
    justifyContent: 'space-between',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  modeOption: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionActive: {
    backgroundColor: '#5355C4',
    borderColor: '#5355C4',
  },
  modeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modeOptionTitleActive: {
    color: '#ffffff',
  },
});
