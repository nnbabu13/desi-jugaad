/**
 * Button - the single button primitive.
 *
 * Variants cover every interaction in the app; sizes keep touch targets
 * consistent (>=44pt). `loading` disables the control and shows a spinner so
 * a submit can never be double-tapped, and `disabled` is a real disabled state
 * rather than a faded-but-tappable fake.
 */

import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { AppText } from './app-text';
import { useTheme } from '@/theme/use-theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'outline'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Leading element, e.g. an icon. */
  icon?: React.ReactNode;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const heights: Record<ButtonSize, number> = {
    sm: theme.layout.controlHeightSm + 4,
    md: theme.layout.controlHeight,
    lg: theme.layout.controlHeightLg,
  };

  const palette = getPalette(variant, theme);

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: heights[size],
          paddingHorizontal: size === 'sm' ? theme.spacing.md : theme.spacing.xl,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? palette.pressed : palette.bg,
          borderColor: palette.border,
          borderWidth: palette.borderWidth,
          opacity: inactive ? 0.55 : pressed ? 0.92 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.fg}
            style={styles.spinner}
          />
        ) : (
          icon
        )}
        <AppText
          variant={size === 'sm' ? 'label' : 'bodyMedium'}
          color={palette.fgRole}
          style={styles.label}
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

interface Palette {
  bg: string;
  pressed: string;
  fg: string;
  fgRole: 'textOnPrimary' | 'primary' | 'secondary' | 'danger' | 'text';
  border: string;
  borderWidth: number;
}

function getPalette(
  variant: ButtonVariant,
  theme: ReturnType<typeof useTheme>,
): Palette {
  const c = theme.colors;
  switch (variant) {
    case 'primary':
      return {
        bg: c.primary,
        pressed: c.primaryPressed,
        fg: c.onPrimary,
        fgRole: 'textOnPrimary',
        border: 'transparent',
        borderWidth: 0,
      };
    case 'secondary':
      return {
        bg: c.secondary,
        pressed: c.secondaryPressed,
        fg: c.onSecondary,
        fgRole: 'textOnPrimary',
        border: 'transparent',
        borderWidth: 0,
      };
    case 'accent':
      return {
        bg: c.accent,
        pressed: theme.palette.orangeDark,
        fg: theme.palette.navyDark,
        fgRole: 'text',
        border: 'transparent',
        borderWidth: 0,
      };
    case 'outline':
      return {
        bg: c.surface,
        pressed: c.surfaceSunken,
        fg: 'primary' as const,
        fgRole: 'primary',
        border: c.borderStrong,
        borderWidth: 1,
      };
    case 'ghost':
      return {
        bg: 'transparent',
        pressed: c.surfaceSunken,
        fg: 'primary' as const,
        fgRole: 'primary',
        border: 'transparent',
        borderWidth: 0,
      };
    case 'danger':
      return {
        bg: c.danger,
        pressed: c.danger,
        fg: c.textOnPrimary,
        fgRole: 'textOnPrimary',
        border: 'transparent',
        borderWidth: 0,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  label: {
    textAlign: 'center',
  },
});

export default Button;
