/**
 * Screen - the standard page container, plus SectionHeader.
 *
 * Gives every screen the same background, horizontal padding, safe-area
 * handling and max content width, which is what keeps spacing consistent
 * across the app (Prompt.md §19).
 */

import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from './app-text';
import { useTheme } from '@/theme/use-theme';
import { layout } from '@/theme/tokens';

export interface ScreenProps {
  children: React.ReactNode;
  /** Which safe-area edges to apply. Defaults to top + sides. */
  edges?: Edge[];
  /** Horizontal padding. Set false for full-bleed content (e.g. galleries). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  padded = true,
  style,
}: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: theme.colors.background }, style]}
    >
      <View
        style={[
          styles.inner,
          padded && { paddingHorizontal: theme.layout.screenPadding },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

/* ---------------------------------------------------------------------------
 * SectionHeader - consistent "Title + optional action" rows
 * ------------------------------------------------------------------------ */

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.sectionHeader, { marginBottom: theme.spacing.md }]}>
      <View style={styles.sectionText}>
        <AppText variant="subheading">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={layout.hitSlop}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <AppText variant="label" color="primary">
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    maxWidth: layout.maxContentWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionText: {
    flex: 1,
    paddingRight: 12,
  },
});

export default Screen;
