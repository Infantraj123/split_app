// @ts-ignore
import React from 'react';
// @ts-ignore
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TEXT_STYLES } from '../constants/theme';
import { Icon } from './Icon';

export type BadgeVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  /** Optional leading Ionicons glyph name. */
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', icon }) => {
  const { colors } = useTheme();
  const palette: Record<BadgeVariant, [string, string]> = {
    primary: [colors.primarySoft, colors.primary],
    secondary: [colors.secondarySoft, colors.secondary],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    neutral: [colors.surfaceAlt, colors.textMuted],
  };
  const [bg, fg] = palette[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={fg} />}
      <Text style={[styles.text, { color: fg }, icon ? styles.textWithIcon : undefined]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    minHeight: 22,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    ...TEXT_STYLES.badge,
  },
  textWithIcon: {
    marginLeft: 4,
  },
});
