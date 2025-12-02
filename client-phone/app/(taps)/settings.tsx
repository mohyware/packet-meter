import { View, StyleSheet, Alert, Switch, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTheme, setTheme, subscribe } from '@/hooks/theme-store';
import React from 'react';
import { ThemedView } from '@/components/themed-view';
import { QRScannerModal } from '@/components/QRScannerModal';
import { useCameraPermissions } from 'expo-camera';
import { healthCheck } from '@/services/reporting';
import type { DeviceStatus, ReportMode } from '@/types/reports';
import {
  useReporterStore,
  DEFAULT_HOST,
  DEFAULT_PORT,
  setDeviceAuth,
} from '@/store/useReporterStore';
import { ReporterSettingsCard } from '@/components/ReporterSettingsCard';
import { DeviceTokenCard } from '@/components/DeviceTokenCard';
import { PermissionsCard } from '@/components/PermissionsCard';
import { ManualActions } from '@/components/ManualActions';
import { BackgroundServiceCard } from '@/components/BackgroundServiceCard';
import { CONNECTION_STATUS_META } from '@/constants/connections-status';

export default function SettingsScreen() {
  const systemScheme = useColorScheme();
  const [themeName, setThemeName] = React.useState(
    getTheme() ?? (systemScheme === 'dark' ? 'dark' : 'light')
  );
  const [showQRScanner, setShowQRScanner] = React.useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoadingToken] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const {
    serverHost,
    serverPort,
    useTls,
    reportMode,
    deviceToken,
    deviceStatus,
    isSavingConfig,
    setServerHost,
    setServerPort,
    setUseTls,
    setReportMode,
    setDeviceToken,
    setIsSavingConfig,
    serverTarget,
    setServerTarget,
    detailedReports,
    setDetailedReports,
  } = useReporterStore();

  const [serverHostInput, setServerHostInput] = React.useState(serverHost);
  const [serverPortInput, setServerPortInput] = React.useState(
    String(serverPort)
  );
  const [isConfigDirty, setIsConfigDirty] = React.useState(false);

  React.useEffect(() => {
    const unsub = subscribe((t) => setThemeName(t));
    return unsub;
  }, []);

  React.useEffect(() => {
    setServerHostInput(serverHost);
    setServerPortInput(String(serverPort));
    setIsConfigDirty(false);
  }, [serverHost, serverPort]);

  const isDark = themeName === 'dark';

  const onToggleTheme = (value: boolean) => {
    setTheme(value ? 'dark' : 'light');
  };

  const ensureCameraPermission = async () => {
    if (permission?.granted) {
      return true;
    }

    const result = await requestPermission();
    return Boolean(result?.granted);
  };

  const handleOpenQRScanner = async () => {
    const granted = await ensureCameraPermission();

    if (granted) {
      setShowQRScanner(true);
      return;
    }

    Alert.alert(
      'Permission required',
      'Please allow camera access to scan QR codes.'
    );
  };

  const handleServerHostChange = (value: string) => {
    setServerHostInput(value);
    setIsConfigDirty(true);
  };

  const handleServerPortChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setServerPortInput(sanitized);
    setIsConfigDirty(true);
  };

  const handleTlsToggle = (value: boolean) => {
    setUseTls(value);
    setIsConfigDirty(true);
  };

  const handleSelectReportMode = (value: ReportMode) => {
    setReportMode(value);
    setIsConfigDirty(true);
  };

  const handleServerTargetChange = (mode: 'cloud' | 'custom') => {
    if (mode === serverTarget) return;

    if (mode === 'cloud') {
      setServerTarget('cloud');
      setUseTls(true);
      setServerHost(DEFAULT_HOST);
      setServerPort(DEFAULT_PORT);
      setServerHostInput(DEFAULT_HOST);
      setServerPortInput(String(DEFAULT_PORT));
      setIsConfigDirty(true);
    } else {
      const customHost = 'localhost';
      const customPort = 8080;
      setServerTarget('custom');
      setUseTls(false);
      setServerHost(customHost);
      setServerPort(customPort);
      setServerHostInput(customHost);
      setServerPortInput(String(customPort));
      setIsConfigDirty(true);
    }
  };

  const handleSaveReporterSettings = async () => {
    const trimmedHost = serverHostInput.trim();
    const parsedPort = Number(serverPortInput);

    if (!trimmedHost) {
      Alert.alert('Invalid Host', 'Server host cannot be empty.');
      return;
    }

    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      Alert.alert('Invalid Port', 'Please enter a valid port number.');
      return;
    }

    setIsSavingConfig(true);
    try {
      setServerHost(trimmedHost);
      setServerPort(parsedPort);
      setIsConfigDirty(false);
      Alert.alert('Settings Saved', 'Reporter settings updated successfully.');
    } catch (err) {
      console.error('Failed to save reporter settings', err);
      Alert.alert(
        'Save Failed',
        'Could not store reporter settings. Please try again.'
      );
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTokenScanned = React.useCallback(
    async (data: string) => {
      const token = data.trim();

      if (!token || token.length < 10) {
        Alert.alert(
          'Invalid QR Code',
          'The scanned QR code does not contain a valid token.'
        );
        return;
      }

      try {
        await setDeviceAuth(token);
        setDeviceToken(token);
        setShowQRScanner(false);

        const healthResult = await healthCheck();
        Alert.alert(
          healthResult.ok ? 'Device Token Updated' : 'Device Token Saved',
          healthResult.ok
            ? 'Device is connected. Waiting for approval from the server.'
            : 'Saved locally but the server did not respond. Please verify the address and try again.'
        );
      } catch (err) {
        console.error('Failed to save device token', err);
        Alert.alert(
          'Save Failed',
          'Could not store the scanned token. Please try again.'
        );
      }
    },
    [setDeviceToken]
  );

  const tokenPreview = deviceToken
    ? `${deviceToken.slice(0, 6)}…${deviceToken.slice(-4)}`
    : null;

  const statusInfo =
    CONNECTION_STATUS_META[deviceStatus as DeviceStatus] ??
    CONNECTION_STATUS_META.not_connected;
  const canSaveReporterSettings =
    isConfigDirty &&
    serverHostInput.trim().length > 0 &&
    Number(serverPortInput) > 0;

  return (
    <ThemedView style={styles.container}>
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleTokenScanned}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Connection Status */}
        <ThemedView style={styles.sectionCard}>
          <ThemedText type="subtitle">Connection Status</ThemedText>
          <View
            style={[styles.statusBadge, { backgroundColor: statusInfo.accent }]}
          >
            <ThemedText
              style={styles.statusBadgeText}
              lightColor="#fff"
              darkColor="#fff"
            >
              {statusInfo.label}
            </ThemedText>
          </View>
          <ThemedText style={styles.statusDescription}>
            {statusInfo.description}
          </ThemedText>
        </ThemedView>

        {/* Device Token */}
        <DeviceTokenCard
          isLoadingToken={isLoadingToken}
          tokenPreview={tokenPreview}
          onScanPress={handleOpenQRScanner}
        />

        {/* Reporter Settings */}
        <ReporterSettingsCard
          serverHost={serverHostInput}
          serverPort={serverPortInput}
          useTls={useTls}
          reportMode={reportMode}
          targetMode={serverTarget}
          canSave={canSaveReporterSettings}
          isSaving={isSavingConfig}
          onChangeHost={handleServerHostChange}
          onChangePort={handleServerPortChange}
          onToggleTls={handleTlsToggle}
          onSelectMode={handleSelectReportMode}
          onChangeTargetMode={handleServerTargetChange}
          onSave={handleSaveReporterSettings}
        />

        {/* Theme */}
        <ThemedView style={styles.sectionCard}>
          <ThemedText type="subtitle">Theme</ThemedText>
          <View style={styles.row}>
            <ThemedText>Light</ThemedText>
            <Switch
              value={isDark}
              onValueChange={onToggleTheme}
              trackColor={{
                false: isDark ? '#3a3a3a' : '#cfcfcf',
                true: '#5355C4',
              }}
              thumbColor={isDark ? '#ffffff' : '#ffffff'}
              ios_backgroundColor={isDark ? '#3a3a3a' : '#cfcfcf'}
            />
            <ThemedText>Dark</ThemedText>
          </View>
        </ThemedView>

        {/* Advanced */}
        <ThemedView style={styles.sectionCard}>
          <ThemedText type="subtitle">Advanced</ThemedText>
          <View style={[styles.row, styles.justifyBetween]}>
            <ThemedText>For testing purposes</ThemedText>
            <Switch
              value={showAdvanced}
              onValueChange={setShowAdvanced}
              trackColor={{ false: '#cfcfcf', true: '#5355C4' }}
              thumbColor="#ffffff"
            />
          </View>
        </ThemedView>

        {showAdvanced && (
          <>
            <ThemedView style={styles.sectionCard}>
              <ThemedText type="subtitle">Detailed Process Reports</ThemedText>
              <View style={[styles.row, styles.justifyBetween]}>
                <View style={styles.col}>
                  <ThemedText>Include All Apps (may be slower)</ThemedText>
                </View>
                <Switch
                  value={detailedReports}
                  onValueChange={setDetailedReports}
                  trackColor={{ false: '#cfcfcf', true: '#5355C4' }}
                  thumbColor="#ffffff"
                />
              </View>
            </ThemedView>
            <ManualActions />
            <PermissionsCard />
            <BackgroundServiceCard />
          </>
        )}
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 10,
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
  helperText: {
    fontSize: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginBottom: 8,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 14,
    lineHeight: 20,
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
    gap: 4,
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
  modeOptionDescription: {
    fontSize: 12,
    color: '#4b5563',
  },
  modeOptionDescriptionActive: {
    color: '#e5e7eb',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
