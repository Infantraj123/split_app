// @ts-ignore
import React from 'react';
// @ts-ignore
import { StyleSheet, ViewStyle } from 'react-native';
// @ts-ignore
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface GradientHeaderBackgroundProps {
  style?: ViewStyle;
}

/** Diagonal purple gradient used for nav bars and hero header banners. */
export const GradientHeaderBackground: React.FC<GradientHeaderBackgroundProps> = ({ style }) => {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
};
