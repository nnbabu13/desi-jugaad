/**
 * BackHeader - the consistent top bar for pushed (non-tab) screens.
 *
 * Every pushed screen gets the same affordance: a back button that always
 * works (falls back to a real destination when the stack is empty - see
 * lib/nav), a title with an optional subtitle, and optional trailing
 * actions. Tab screens keep ScreenHeader instead.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { goBackSafe } from '@/lib/nav';
import { useTheme } from '@/theme/use-theme';
import type { Href } from 'expo-router';

export interface BackHeaderProps {
  title: string;
  subtitle?: string;
  /** Where Back lands when this screen is the first in the stack. */
  fallback?: Href;
  /** Rendered on the trailing edge, e.g. a block/settings action. */
  actions?: React.ReactNode;
}

export function BackHeader({ title, subtitle, fallback, actions }: BackHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          borderBottomColor: theme.colors.border,
          minHeight: theme.layout.headerHeight,
        },
      ]}
    >
      <Pressable
        onPress={() => goBackSafe(fallback)}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={theme.layout.hitSlop}
        style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </Pressable>

      <View style={styles.titleWrap}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="caption"
            color="textMuted"
            numberOfLines={1}
            style={{ marginTop: 1 }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
});

export default BackHeader;
