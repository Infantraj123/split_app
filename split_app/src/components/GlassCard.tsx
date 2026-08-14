// @ts-ignore
import React, { ReactNode } from 'react';
// @ts-ignore
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING } from '../constants/theme';

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * Translucent-overlay-plus-border "glass" surface meant to sit on top of the
 * gradient header. Not a real blur (no blur library in this app) — reads
 * convincingly via translucency and a light border instead of elevation.
 */
export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
});
