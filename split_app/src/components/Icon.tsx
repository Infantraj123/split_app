// @ts-ignore
import React from 'react';
// @ts-ignore
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

/**
 * Thin wrapper around the Ionicons font so screens never import the raw
 * vector-icons module directly — keeps the icon set swappable in one place.
 */
export const Icon: React.FC<IconProps> = ({ name, size = 20, color }) => {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.text} />;
};
