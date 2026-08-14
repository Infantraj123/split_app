// @ts-ignore
import React from 'react';
// @ts-ignore
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TEXT_STYLES, ThemeColors } from '../constants/theme';
import { Icon } from './Icon';

interface EmptyStateProps {
  /** Ionicons glyph name. */
  icon: string;
  text: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, text }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.container}>
      <Icon name={icon} size={36} color={colors.textMuted} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
    },
    text: {
      ...TEXT_STYLES.bodyMuted,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: SPACING.sm,
    },
  });
