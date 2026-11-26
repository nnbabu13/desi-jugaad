/**=============================================================================
 * Tab bar - Home · Explore · Post · Messages · Profile
 * ============================================================================
 *
 * Built with headless tab primitives so the Post action can be a raised,
 * visually prominent button (Prompt.md §3) rather than an ordinary tab item.
 *
 * Post does not switch tabs: it presents the posting sheet over the current
 * screen, which is what §12 asks for.
 *
 * Accessibility: each item exposes `tab` role + `selected` state, and the
 * Post button exposes `button` + a label that does not depend on the icon.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/theme/use-theme';

export type TabItem = {
  name: string;
  href: Href;
  label: string;
  icon: string;
  iconActive: string;
  /** Optional unread/attention badge. */
  badge?: number;
};

export const TAB_ITEMS: TabItem[] = [
  {
    name: 'home',
    href: '/(tabs)',
    label: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
  },
  {
    name: 'explore',
    href: '/(tabs)/explore',
    label: 'Explore',
    icon: 'compass-outline',
    iconActive: 'compass',
  },
  {
    name: 'messages',
    href: '/(tabs)/messages',
    label: 'Messages',
    icon: 'chatbubble-outline',
    iconActive: 'chatbubble',
  },
  {
    name: 'profile',
    href: '/(tabs)/profile',
    label: 'Profile',
    icon: 'person-outline',
    iconActive: 'person',
  },
];

/* --------------------------------------------------------------------------- *
 * Standard tab item
 * ------------------------------------------------------------------------ */

export type TabButtonProps = {
  item: TabItem;
  isFocused: boolean;
  onPress?: () => void;
  triggerRef?: Ref<View>;
};

export function TabButton({ item, isFocused, ...props }: TabButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={item.label}
      style={({ pressed }: any) => [
        styles.item,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={isFocused ? item.iconActive : item.icon as any}
          size={24}
          color={isFocused ? theme.colors.primary : theme.colors.tabInactive}
        />
        {item.badge && item.badge > 0 ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.danger, borderColor: theme.colors.tabBackground },
            ]}
          >
            <AppText variant="caption" color="textInverse" style={styles.badgeText}>
              {item.badge > 99 ? '99+' : String(item.badge)}
            </AppText>
          </View>
        ) : null}
      </View>

      <AppText
        variant="caption"
        style={[
          { color: isFocused ? theme.colors.primary : theme.colors.tabInactive },
          { fontWeight: isFocused ? '700' : '500' },
          { marginTop: 2 },
        ]}
        numberOfLines={1}
      >
        {item.label}
      </AppText>
    </Pressable>
  );
}

/* --------------------------------------------------------------------------- *
 * Prominent Post action
 * ------------------------------------------------------------------------ */

export interface PostButtonProps {
  onPress: () => void;
}

/** The raised centre action. Deliberately larger than the surrounding items and
 * offset upwards so it reads as the primary action in the bar.
 */
export function PostButton({ onPress }: PostButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Create a post"
      accessibilityHint="Opens options for listing a room, offering a service, parcel help or asking the community"
      testID="post-button"
      style={({ pressed }: any) => [
        styles.postWrap,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View
        style={[
          styles.postCircle,
          {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.tabBackground,
            ...theme.shadow.md,
          },
        ]}
      >
        <Ionicons name="add" size={30} color={theme.colors.textOnPrimary} />
      </View>
      <AppText
        variant="caption"
        style={{ color: theme.colors.primary, fontWeight: '700', marginTop: 2 }}
        numberOfLines={1}
      >
        Post
      </AppText>
    </Pressable>
  );
}

/* --------------------------------------------------------------------------- *
 * Bar container
 * ------------------------------------------------------------------------ */

export interface TabBarShellProps {
  /** The visible children rendered between the Post button and the side tabs. */
  children: ReactNode;
}

/** The shell that wraps the whole bar - gives it the right background and safe-area. */
export function TabBarShell({ children }: TabBarShellProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.tabBackground,
          borderTopColor: theme.colors.border,
          paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
        },
        theme.shadow.lg,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 2,
  },
  iconWrap: {
    position: 'relative',
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
  postWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  postCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginTop: -18,
  },
});