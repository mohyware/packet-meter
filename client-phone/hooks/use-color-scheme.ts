import { useColorScheme as useSystemColorScheme } from 'react-native';
import { getTheme, subscribe } from '@/hooks/theme-store';
import React from 'react';

export function useColorScheme() {
  const system = useSystemColorScheme();
  const [scheme, setScheme] = React.useState(getTheme() ?? system ?? 'light');

  React.useEffect(() => {
    const unsub = subscribe((t) => setScheme(t));
    return unsub;
  }, []);

  // If there is no override in the store, follow system changes
  React.useEffect(() => {
    if (getTheme() == null) {
      setScheme(system ?? 'light');
    }
  }, [system]);

  return scheme;
}
