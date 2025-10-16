import { Link, Stack } from 'expo-router';
import { Image, View, StyleSheet, Button, NativeModules, Linking, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useState } from 'react';
const { NetworkUsage, UsageAccess, MyModule } = NativeModules;

async function openSettings() {
    try {
        await Linking.openSettings();
    } catch (error) {
        console.error(error);
    }
}

function LogoTitle() {
    return (
        <Image style={styles.image} source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }} />
    );
}

export async function getTotalUsage() {
    let totalUsage = 0;
    try {
        const bytes = await NetworkUsage.getTotalUsage();
        totalUsage = bytes / (1024 ** 2);
        console.log('Total usage:', totalUsage, 'MB');
        return totalUsage;
    } catch (e) {
        console.error(e);
    }
}

const ensurePermission = async () => {
    const granted = await UsageAccess.hasUsageAccess();
    if (!granted) {
        UsageAccess.openUsageAccessSettings();
    } else {
        Alert.alert("Permission already granted ✅");
    }
};

export default function HomeScreen() {
    const [count, setCount] = useState(0);

    return (
        <View style={styles.container}>
            <Button title="Show toast" onPress={() => MyModule.showToast('Hello from React Native!')} />
            <Button title="Ensure permission" onPress={ensurePermission} />
            {/* <ThemedText type="title">Total usage: {getTotalUsage()}</ThemedText> */}
            <Button title="Open settings" onPress={openSettings} />
            <Stack.Screen
                options={{
                    title: 'My home',
                    headerStyle: { backgroundColor: '#f4511e' },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                    headerRight: () => <Button onPress={() => setCount(c => c + 1)} title="Update count" />,

                    headerTitle: () => <LogoTitle />,
                }}
            />
            <ThemedText type="title">Home</ThemedText>
            <ThemedText type="link">
                <Link
                    href={{
                        pathname: '/details/[id]',
                        params: { id: 'bacon' },
                    }}>
                    View user details
                </Link>
            </ThemedText>
            <ThemedText>Count: {count}</ThemedText>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: 50,
        height: 50,
    },
});
