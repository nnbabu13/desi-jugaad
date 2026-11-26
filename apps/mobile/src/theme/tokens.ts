/**
 * ============================================================================
 * Desi Jugaad - Design tokens
 * ============================================================================
 *
 * Single source of truth for every visual constant in the mobile app. Screens
 * must never hard-code a colour, radius, shadow or spacing value - import from
 * here so the design system stays consistent and is trivially re-themable.
 *
 * Brand (Prompt.md §2):
 *   Deep navy   -> primary brand colour
 *   Teal        -> secondary colour
 *   Warm orange -> selected highlights only (never a large fill)
 *   Light bg    -> clean white / light backgrounds
 *
 * Deliberately avoided per the brief: excessive gradients, too many colours,
 * oversized buttons, desktop-style density.
 */

import { Platform, TextStyle, ViewStyle } from 'react-native';

/* ---------------------------------------------------------------------------
 * Colour
 * ------------------------------------------------------------------------ */

export const palette = {
  // Brand
  navy: '#17365D',
  navyDark: '#0F2440',
  navySoft: '#2C5486',
  navyTint: '#EAF0F8',

  teal: '#159A91',
  tealDark: '#0F7A73',
  tealSoft: '#3FB5AD',
  tealTint: '#E4F5F4',

  orange: '#F4A340',
  orangeDark: '#D98A26',
  orangeSoft: '#F8BE6E',
  orangeTint: '#FEF3E4',

  // Neutrals
  white: '#FFFFFF',
  bg: '#F7F9FC',
  bgSunken: '#EEF2F7',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#7A879B',
  textInverse: '#FFFFFF',

  // Semantic
  danger: '#D64545',
  dangerTint: '#FCEDED',
  success: '#1E9E5A',
  successTint: '#E7F6EE',
  warning: '#B7791F',
  warningTint: '#FBF3DF',

  // Overlay
  scrim: 'rgba(15, 36, 64, 0.45)',
  skeleton: '#E8EDF4',
  skeletonHighlight: '#F3F6FA',
} as const;

/**
 * Light + dark colour roles. Each key maps to a semantic role so screens read
 * `colors.surface` rather than `colors.white` - which keeps dark mode working
 * without touching a single screen.
 */
export const colors = {
  light: {
    background: palette.bg,
    surface: palette.white,
    surfaceSunken: palette.bgSunken,
    surfaceRaised: palette.white,

    primary: palette.navy,
    primaryPressed: palette.navyDark,
    primaryTint: palette.navyTint,
    onPrimary: palette.textInverse,

    secondary: palette.teal,
    secondaryPressed: palette.tealDark,
    secondaryTint: palette.tealTint,
    onSecondary: palette.textInverse,

    accent: palette.orange,
    accentTint: palette.orangeTint,

    text: palette.text,
    textSecondary: palette.textSecondary,
    textMuted: palette.textMuted,
    textInverse: palette.textInverse,
    textOnPrimary: palette.textInverse,

    border: palette.border,
    borderStrong: palette.borderStrong,

    danger: palette.danger,
    dangerTint: palette.dangerTint,
    success: palette.success,
    successTint: palette.successTint,
    warning: palette.warning,
    warningTint: palette.warningTint,

    scrim: palette.scrim,
    skeleton: palette.skeleton,
    skeletonHighlight: palette.skeletonHighlight,

    tabBackground: palette.white,
    tabIndicator: palette.navyTint,
    tabInactive: palette.textMuted,
  },
  dark: {
    background: '#0B1220',
    surface: '#141C2B',
    surfaceSunken: '#0F1725',
    surfaceRaised: '#1B2536',

    primary: palette.navySoft,
    primaryPressed: palette.navy,
    primaryTint: 'rgba(44, 84, 134, 0.28)',
    onPrimary: palette.textInverse,

    secondary: palette.tealSoft,
    secondaryPressed: palette.teal,
    secondaryTint: 'rgba(63, 181, 173, 0.22)',
    onSecondary: palette.textInverse,

    accent: palette.orangeSoft,
    accentTint: 'rgba(248, 190, 110, 0.16)',

    text: '#F1F5F9',
    textSecondary: '#B6C2D2',
    textMuted: '#8494AA',
    textInverse: '#0F172A',
    textOnPrimary: palette.textInverse,

    border: '#26324A',
    borderStrong: '#33415C',

    danger: '#F08585',
    dangerTint: 'rgba(240, 133, 133, 0.16)',
    success: '#5CD395',
    successTint: 'rgba(92, 211, 149, 0.16)',
    warning: '#EFC46A',
    warningTint: 'rgba(239, 196, 106, 0.16)',

    scrim: 'rgba(0, 0, 0, 0.6)',
    skeleton: '#1E293B',
    skeletonHighlight: '#273449',

    tabBackground: '#141C2B',
    tabIndicator: 'rgba(44, 84, 134, 0.35)',
    tabInactive: '#8494AA',
  },
} as const;

export type ColorRole = keyof (typeof colors)['light'];
export type ColorScheme = keyof typeof colors;

/* ---------------------------------------------------------------------------
 * Spacing (4pt scale)
 * ------------------------------------------------------------------------ */

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
} as const;

/* ---------------------------------------------------------------------------
 * Radius
 * ------------------------------------------------------------------------ */

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/* ---------------------------------------------------------------------------
 * Typography
 * ------------------------------------------------------------------------ */

const fontFamily = Platform.select({
  ios: { sans: 'System' },
  android: { sans: 'sans-serif' },
  default: { sans: 'System' },
}) as { sans: string };

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 18,
  md: 21,
  lg: 23,
  xl: 26,
  xxl: 30,
  xxxl: 36,
  display: 42,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/** Named text styles - the only way screens should style text. */
export const type = {
  display: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.display,
    lineHeight: lineHeight.display,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.xxxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  heading: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  subheading: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: fontWeight.medium,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.semibold,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
  },
  overline: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof type;

/* ---------------------------------------------------------------------------
 * Elevation - subtle shadows only (Prompt.md: "subtle shadows")
 * ------------------------------------------------------------------------ */

export const shadow = {
  none: Platform.select<ViewStyle>({
    ios: { shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: 0 },
    default: {},
  })!,
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F2440',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  })!,
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F2440',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 4 },
    default: {},
  })!,
  lg: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F2440',
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
    default: {},
  })!,
} as const;

/* ---------------------------------------------------------------------------
 * Layout
 * ------------------------------------------------------------------------ */

export const layout = {
  screenPadding: spacing.lg,
  cardPadding: spacing.lg,
  maxContentWidth: 720,
  controlHeight: 48,
  controlHeightSm: 36,
  controlHeightLg: 56,
  tabBarHeight: 56,
  headerHeight: 56,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

/* ---------------------------------------------------------------------------
 * Motion
 * ------------------------------------------------------------------------ */

export const motion = {
  fast: 150,
  base: 220,
  slow: 320,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

/** Complete theme object for components that prefer a single import. */
export const tokens = {
  colors,
  palette,
  spacing,
  radius,
  fontSize,
  lineHeight,
  fontWeight,
  type,
  shadow,
  layout,
  motion,
} as const;

export type Theme = typeof tokens;
