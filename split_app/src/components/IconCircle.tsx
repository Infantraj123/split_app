// @ts-ignore
import React from 'react';
// @ts-ignore
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Icon } from './Icon';
import { BadgeVariant } from './Badge';

interface IconCircleProps {
  name: string;
  variant?: BadgeVariant;
  size?: number;
}

/** A small colored circular backdrop behind an icon — used as a leading "avatar-style" accent on list rows. */
export const IconCircle: React.FC<IconCircleProps> = ({ name, variant = 'primary', size = 40 }) => {
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
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Icon name={name} size={size * 0.5} color={fg} />
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
