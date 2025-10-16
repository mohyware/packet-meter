import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { HelloWave } from '@/components/hello-wave';
import { Link } from 'expo-router';
export default function SettingsScreen() {
    return (
        <View style={styles.container}>
            <ThemedText type="title">Settings</ThemedText>
            <ThemedText type="link">Settings Modal</ThemedText>
            <Link href="/(home)/index">Home</Link>
            <HelloWave />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
