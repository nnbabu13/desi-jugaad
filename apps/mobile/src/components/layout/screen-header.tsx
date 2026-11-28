/**
 * ScreenHeader - the consistent top bar for tab screens.
 *
 * Prompt.md §4 specifies the Home header (logo, current city/country,
 * notification icon, avatar); the other tabs reuse the same shell so the app
 * feels like one product rather than five unrelated screens.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/theme/use-theme';

export interface HeaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Optional dot indicating something needs attention. */
  dot?: boolean;
}

export interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  /**
   * Makes the subtitle tappable (Home's "Choose your city"). Omitted on every
   * other tab so the subtitle stays plain text there.
   */
  onSubtitlePress?: () => void;
  /** Brand wordmark instead of a plain title (Home). */
  brand?: boolean;
  /** Leading avatar for Home. */
  avatar?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: HeaderAction[];
  /** Rendered below the bar, e.g. a search field. */
  children?: React.ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  onSubtitlePress,
  brand = false,
  avatar,
  leading,
  actions = [],
  children,
}: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { minHeight: theme.layout.headerHeight }]}>
        <View style={styles.leading}>
          {leading ?? null}
          {avatar ?? null}

          <View style={styles.titleWrap}>
            {brand ? (
              <View style={styles.brandRow}>
                <View
                  style={[
                    styles.brandMark,
                    { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm },
                  ]}
                >
                  <AppText variant="label" color="textInverse">
                    DJ
                  </AppText>
                </View>
                <AppText variant="subheading" color="primary">
                  Desi Jugaad
                </AppText>
              </View>
            ) : (
              <AppText variant="subheading" numberOfLines={1}>
                {title}
              </AppText>
            )}

            {subtitle ? (
              onSubtitlePress ? (
                <Pressable
                  onPress={onSubtitlePress}
                  accessibilityRole="button"
                  accessibilityLabel={`${subtitle}. Change your city`}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    marginTop: 1,
                    opacity: pressed ? 0.6 : 1,
                    alignSelf: 'flex-start',
                    maxWidth: '100%',
                  })}
                >
                  <AppText
                    variant="caption"
                    color="textMuted"
                    numberOfLines={1}
                    style={{ flexShrink: 1 }}
                  >
                    {subtitle}
                  </AppText>
                  <Ionicons name="chevron-down" size={12} color={theme.colors.textMuted} />
                </Pressable>
              ) : (
                <AppText variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 1 }}>
                  {subtitle}
                </AppText>
              )
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              hitSlop={theme.layout.hitSlop}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name={action.icon} size={20} color={theme.colors.text} />
              {action.dot ? (
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: theme.colors.danger, borderColor: theme.colors.surface },
                  ]}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});

export default ScreenHeader;
