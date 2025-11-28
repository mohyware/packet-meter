import { CameraView } from 'expo-camera';
import {
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Modal,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState } from 'react';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess?: (data: string) => void | Promise<void>;
}

export function QRScannerModal({
  visible,
  onClose,
  onScanSuccess,
}: QRScannerModalProps) {
  const [scanned, setScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    setScanned(true);

    if (onScanSuccess) {
      Promise.resolve(onScanSuccess(data)).catch((err) => {
        console.warn('QR scanner onScanSuccess handler failed', err);
      });
    }

    setTimeout(() => {
      setScanned(false);
    }, 2000);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {Platform.OS === 'android' ? <StatusBar hidden /> : null}

        <View style={styles.header}>
          <ThemedText style={styles.headerText}>Scan QR Code</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ThemedText
              style={styles.closeButtonText}
              darkColor="#fff"
              lightColor="#fff"
            >
              ✕
            </ThemedText>
          </TouchableOpacity>
        </View>

        <CameraView
          style={styles.camStyle}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  camStyle: {
    flex: 1,
    width: '100%',
  },
});
