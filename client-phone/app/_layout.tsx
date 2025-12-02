import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTheme, subscribe } from '@/hooks/theme-store';
import React from 'react';
// import { registerBackgroundTasks } from '@/services/expoBackgroundTasks';
import { startBackgroundActions } from '@/services/backgroundActions';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const [themeName, setThemeName] = React.useState(
    getTheme() ?? (systemScheme === 'dark' ? 'dark' : 'light')
  );

  React.useEffect(() => {
    const unsub = subscribe((t) => setThemeName(t));
    return unsub;
  }, []);

  // expo-background-fetch (not used)
  // React.useEffect(() => {
  //   registerBackgroundTasks(15).catch((err) => {
  //     console.error('Failed to register background tasks:', err);
  //   });
  // }, []);

  // Start background actions with react-native-background-actions
  React.useEffect(() => {
    startBackgroundActions(15).catch((err) => {
      console.error('Failed to start background actions:', err);
    });
  }, []);

  const theme = themeName === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: '#5355C4',
          }}
        >
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: '#5355C4',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          >
            <Stack.Screen name="(taps)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </SafeAreaView>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
