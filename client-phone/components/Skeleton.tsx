import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: SkeletonProps) {
  const bg = useThemeColor({ light: '#e1e3e8', dark: '#2a2d2e' }, 'icon');
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number | `${number}%`,
          height: height as number | `${number}%`,
          borderRadius: radius,
          backgroundColor: bg,
          opacity,
        },
        style,
      ]}
    />
  );
}
