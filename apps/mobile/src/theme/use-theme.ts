/**
 * Resolves the active theme (light/dark) from the system colour scheme and
 * exposes the token groups. Screens and components consume this rather than
 * importing `colors` directly, so a future in-app theme toggle only has to
 * change this one provider.
 */

import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  ColorRole,
  ColorScheme,
  colors,
  fontSize,
  fontWeight,
  layout,
  lineHeight,
  palette,
  radius,
  shadow,
  spacing,
  type,
  TypeStyle,
} from './tokens';

export interface AppTheme {
  scheme: ColorScheme;
  colors: Record<ColorRole, string>;
  palette: typeof palette;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  fontWeight: typeof fontWeight;
  type: typeof type;
  shadow: typeof shadow;
  layout: typeof layout;
}

export function useTheme(): AppTheme {
  const system = useSystemColorScheme();
  const scheme: ColorScheme = system === 'dark' ? 'dark' : 'light';

  return {
    scheme,
    colors: colors[scheme],
    palette,
    spacing,
    radius,
    fontSize,
    lineHeight,
    fontWeight,
    type,
    shadow,
    layout,
  };
}

export type { ColorRole, ColorScheme, TypeStyle };
