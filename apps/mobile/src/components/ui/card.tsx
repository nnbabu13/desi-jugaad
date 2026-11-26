/**
 * Card - the rounded, subtly-shadowed surface used for every list item,
 * panel and grouping in the app (Prompt.md §2: "Rounded cards, subtle
 * shadows").
 *
 * `interactive` gives press feedback so a tappable card feels tappable
 * rather than looking like a static panel.
 */

import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/use-theme';

export interface CardProps {
  children: React.ReactNode;
  /** Adds press feedback + a11y role. Omit for static surfaces. */
  onPress?: () => void;
  /** Padding preset. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Elevates the card above the background. */
  elevated?: boolean;
  /** Removes the border for a cleaner look on raised surfaces. */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({
  children,
  onPress,
  padding = 'md',
  elevated = false,
  bordered = true,
  style,
  accessibilityLabel,
  testID,
}: CardProps) {
  const theme = useTheme();

  const paddings: Record<NonNullable<CardProps['padding']>, number> = {
    none: 0,
    sm: theme.spacing.sm,
    md: theme.spacing.lg,
    lg: theme.spacing.xl,
  };

  const surface: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: paddings[padding],
    borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
    borderColor: theme.colors.border,
    ...(elevated ? theme.shadow.md : theme.shadow.sm),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          surface,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[styles.base, surface, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },
});

export default Card;
