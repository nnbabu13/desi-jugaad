/**
 * Avatar - profile image with an initials fallback.
 *
 * Falls back to initials on a deterministic tinted background so a missing or
 * failed image never leaves an empty circle. Never renders a "verified" mark:
 * verification is a separate signal, shown by the badge components only when
 * it genuinely exists.
 */

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useTheme } from '@/theme/use-theme';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 88,
};

export interface AvatarProps {
  /** Used for the initials fallback and the accessibility label. */
  name: string;
  uri?: string | null;
  size?: AvatarSize | number;
  /** Shows a coloured ring - use for "story"-style emphasis only. */
  ring?: boolean;
}

/** Deterministic hue from the name, so the same person always matches. */
function hueFrom(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, uri, size = 'md', ring = false }: AvatarProps) {
  const theme = useTheme();
  const px = typeof size === 'number' ? size : SIZES[size];
  const initials = initialsOf(name);

  const background = uri
    ? theme.colors.surfaceSunken
    : `hsl(${hueFrom(name)}, 45%, 90%)`;
  const foreground = uri ? theme.colors.text : `hsl(${hueFrom(name)}, 50%, 32%)`;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.wrap,
        {
          width: px,
          height: px,
          borderRadius: px / 2,
          backgroundColor: background,
          borderWidth: ring ? 2 : StyleSheet.hairlineWidth,
          borderColor: ring ? theme.colors.secondary : theme.colors.border,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          alt={name}
        />
      ) : (
        <AppText
          variant="label"
          style={{
            color: foreground,
            fontSize: Math.max(10, px * 0.36),
            lineHeight: Math.max(12, px * 0.44),
          }}
        >
          {initials}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default Avatar;
