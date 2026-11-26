/**
 * ============================================================================
 * Post sheet (Prompt.md §12)
 * ============================================================================
 *
 * Presented as a transparent modal over whatever the user is doing, so the
 * prominent Post button in the tab bar always leads to the same place.
 *
 * All seven §12 actions are here, each opening its own form. "My drafts"
 * sits below a divider because drafts belong to the same creation flow but
 * are not a posting type.
 *
 * The sheet animates in, dismisses on scrim tap or the close control, and
 * traps nothing: the system back gesture still works.
 */

import { Ionicons } from '@expo/vector-icons';
import { goBackSafe } from '@/lib/nav';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { POST_TYPES, PostTypeDef } from '@/lib/post-types';
import { draftsRepo } from '@/lib/drafts';
import type { IoniconName } from '@/lib/icons';
import { useTheme } from '@/theme/use-theme';

const SHEET_ANIMATION_MS = 220;

export default function PostSheetScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [progress] = useState(() => new Animated.Value(0));
  const [draftCount, setDraftCount] = useState<number | null>(null);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: SHEET_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  useEffect(() => {
    let cancelled = false;
    draftsRepo
      .count()
      .then((n) => {
        if (!cancelled) setDraftCount(n);
      })
      .catch(() => {
        if (!cancelled) setDraftCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => goBackSafe();

  const openForm = (type: PostTypeDef) =>
    router.replace({ pathname: '/post-form', params: { type: type.id } });

  const openDrafts = () => router.replace('/drafts');

  return (
    <View style={styles.root} accessibilityViewIsModal>
      {/* Scrim */}
      <Animated.View style={[styles.scrim, { backgroundColor: theme.colors.scrim, opacity: progress }]} />

      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close posting options"
        style={StyleSheet.absoluteFill}
      />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
            borderTopLeftRadius: theme.radius.xxl,
            borderTopRightRadius: theme.radius.xxl,
            borderColor: theme.colors.border,
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [48, 0],
                }),
              },
            ],
          },
          theme.shadow.lg,
        ]}
      >
        {/* Grabber */}
        <View style={[styles.grabber, { backgroundColor: theme.colors.borderStrong }]} />

        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="subheading">Create</AppText>
            <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
              What would you like to share?
            </AppText>
          </View>

          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={theme.layout.hitSlop}
            style={({ pressed }) => [
              styles.closeBtn,
              {
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radius.pill,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={{ paddingBottom: theme.spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {POST_TYPES.map((type) => (
            <SheetRow
              key={type.id}
              icon={type.icon}
              label={type.label}
              description={type.description}
              tint={type.tint}
              onPress={() => openForm(type)}
            />
          ))}

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <SheetRow
            icon="document-text-outline"
            label="My drafts"
            tint="neutral"
            description={
              draftCount === null
                ? 'Saved on this device'
                : draftCount === 0
                  ? 'Nothing saved yet'
                  : `${draftCount} saved ${draftCount === 1 ? 'draft' : 'drafts'} on this device`
            }
            onPress={openDrafts}
            trailing={
              draftCount && draftCount > 0 ? (
                <View
                  style={[
                    styles.count,
                    {
                      backgroundColor: theme.colors.primaryTint,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                >
                  <AppText variant="caption" color="primary">
                    {draftCount}
                  </AppText>
                </View>
              ) : undefined
            }
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/* --------------------------------------------------------------------------- *
 * Row
 * ------------------------------------------------------------------------ */

const TINTS = {
  primary: { bg: 'primaryTint', fg: 'primary' },
  secondary: { bg: 'secondaryTint', fg: 'secondary' },
  accent: { bg: 'accentTint', fg: 'text' },
  neutral: { bg: 'surfaceSunken', fg: 'textSecondary' },
} as const;

function SheetRow({
  icon,
  label,
  description,
  tint = 'neutral',
  onPress,
  trailing,
}: {
  icon: IoniconName;
  label: string;
  description: string;
  tint?: PostTypeDef['tint'];
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();
  const tintStyle = TINTS[tint];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      style={({ pressed }) => [
        styles.row,
        {
          borderRadius: theme.radius.lg,
          backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
        },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: theme.colors[tintStyle.bg],
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={
            tintStyle.fg === 'text'
              ? theme.palette.orangeDark
              : theme.colors[tintStyle.fg]
          }
        />
      </View>

      <View style={styles.rowText}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 2 }}>
          {description}
        </AppText>
      </View>

      {trailing}

      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '86%',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  rowIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    marginHorizontal: 8,
  },
  count: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
});
