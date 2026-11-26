/**
 * Category shortcuts - the four main services (Prompt.md §4) and the
 * category tabs on Explore (§5).
 *
 * Both surfaces share this definition so a category always has one name, one
 * icon and one colour across the app.
 */

import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/theme/use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type CategoryId = 'rentals' | 'services' | 'parcel' | 'community';

export interface CategoryDef {
  id: CategoryId;
  label: string;
  shortLabel: string;
  icon: IoniconName;
  /** Tint used for the shortcut tile background. */
  tint: 'primary' | 'secondary' | 'accent' | 'neutral';
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'rentals',
    label: 'Rooms & Rentals',
    shortLabel: 'Rentals',
    icon: 'home-outline',
    tint: 'primary',
    description: 'Find a room, flatmate or entire property.',
  },
  {
    id: 'services',
    label: 'Local Services',
    shortLabel: 'Services',
    icon: 'construct-outline',
    tint: 'secondary',
    description: 'Trusted local help, from tutors to technicians.',
  },
  {
    id: 'parcel',
    label: 'Parcel Assistance',
    shortLabel: 'Parcel',
    icon: 'airplane-outline',
    tint: 'accent',
    description: 'Connect with travellers going your way.',
  },
  {
    id: 'community',
    label: 'Community',
    shortLabel: 'Community',
    icon: 'people-outline',
    tint: 'neutral',
    description: 'Questions, tips and recommendations nearby.',
  },
];

export function categoryById(id: CategoryId): CategoryDef {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}

/* ---------------------------------------------------------------------------
 * Shortcut grid (Home)
 * ------------------------------------------------------------------------ */

export interface CategoryShortcutsProps {
  onSelect: (id: CategoryId) => void;
}

export function CategoryShortcuts({ onSelect }: CategoryShortcutsProps) {
  const theme = useTheme();

  const tints = {
    primary: theme.colors.primaryTint,
    secondary: theme.colors.secondaryTint,
    accent: theme.colors.accentTint,
    neutral: theme.colors.surfaceSunken,
  } as const;

  const icons = {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    accent: theme.palette.orangeDark,
    neutral: theme.colors.textSecondary,
  } as const;

  return (
    <View style={styles.grid}>
      {CATEGORIES.map((cat) => (
        <Pressable
          key={cat.id}
          onPress={() => onSelect(cat.id)}
          accessibilityRole="button"
          accessibilityLabel={cat.label}
          accessibilityHint={cat.description}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
            theme.shadow.sm,
          ]}
        >
          <View
            style={[
              styles.tileIcon,
              { backgroundColor: tints[cat.tint], borderRadius: theme.radius.md },
            ]}
          >
            <Ionicons name={cat.icon} size={24} color={icons[cat.tint]} />
          </View>

          <AppText
            variant="label"
            align="center"
            style={{ marginTop: theme.spacing.sm }}
            numberOfLines={2}
          >
            {cat.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Category tabs (Explore)
 * ------------------------------------------------------------------------ */

export interface CategoryTabsProps {
  value: CategoryId | 'all';
  onChange: (id: CategoryId | 'all') => void;
}

export function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  const theme = useTheme();

  const tabs: { id: CategoryId | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    ...CATEGORIES.map((c) => ({ id: c.id as CategoryId, label: c.shortLabel })),
  ];

  return (
    <View
      style={[styles.tabs, { borderBottomColor: theme.colors.border }]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={({ pressed }) => [
              styles.tab,
              {
                opacity: pressed ? 0.6 : 1,
                borderBottomColor: active ? theme.colors.primary : 'transparent',
                borderBottomWidth: active ? 2 : 0,
              },
            ]}
          >
            <AppText
              variant="bodyMedium"
              style={{
                color: active ? theme.colors.primary : theme.colors.textMuted,
                fontWeight: active ? '700' : '500',
              }}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  tile: {
    width: '48.5%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 44,
  },
});
