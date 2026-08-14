export const lightColors = {
  primary: '#6366F1', // indigo
  primaryDark: '#4F46E5',
  primarySoft: '#EEF2FF',
  secondary: '#10B981', // emerald
  secondarySoft: '#ECFDF5',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  background: '#F1F5F9', // slate-100 app background
  surface: '#FFFFFF', // card background
  surfaceAlt: '#F8FAFC', // inset surfaces (chips, inputs)
  text: '#0F172A', // slate-900
  textMuted: '#64748B', // slate-500
  border: '#E2E8F0', // slate-200
  /** Text/icon color placed on top of a `primary`-filled surface. */
  onPrimary: '#FFFFFF',
  /** Diagonal gradient used for nav/header chrome. */
  gradientStart: '#7C6CFB',
  gradientEnd: '#4C1D95',
  /** Translucent "glass" overlay for surfaces sitting on top of the gradient. */
  glassBg: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.28)',
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  primary: '#818CF8',
  primaryDark: '#6366F1',
  primarySoft: '#1E1B4B',
  secondary: '#34D399',
  secondarySoft: '#064E3B',
  danger: '#F87171',
  dangerSoft: '#450A0A',
  warning: '#FBBF24',
  warningSoft: '#451A03',
  background: '#0B1120',
  surface: '#161E2E',
  surfaceAlt: '#1E293B',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#28344A',
  onPrimary: '#0B1120',
  gradientStart: '#6D28D9',
  gradientEnd: '#2E1065',
  glassBg: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.28)',
};

export const SPACING = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

/** Soft elevation used on cards and primary buttons in light mode. */
export const SHADOW_LIGHT = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

/**
 * Shadows barely read on dark backgrounds regardless of opacity, so cards
 * additionally rely on a colors.border hairline for elevation in dark mode.
 */
export const SHADOW_DARK = {
  shadowColor: '#000000',
  shadowOpacity: 0.4,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export type ThemeShadow = typeof SHADOW_LIGHT;

/** Fixed weight-per-size pairing so text hierarchy stays consistent across screens. */
export const TEXT_STYLES = {
  heroTitle: { fontSize: FONT_SIZES.xxl, fontWeight: '700' as const },
  cardValue: { fontSize: FONT_SIZES.xl, fontWeight: '700' as const },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600' as const },
  label: { fontSize: FONT_SIZES.md, fontWeight: '600' as const },
  body: { fontSize: FONT_SIZES.md, fontWeight: '400' as const },
  bodyMuted: { fontSize: FONT_SIZES.sm, fontWeight: '400' as const },
  badge: { fontSize: FONT_SIZES.xs, fontWeight: '700' as const },
};
