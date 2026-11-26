/**
 * ============================================================================
 * Home (Prompt.md §4)
 * ============================================================================
 *
 * Layout:
 *   Header        brand · current city/country · notifications · avatar
 *   Search        "What are you looking for?"
 *   Shortcuts     Rooms & Rentals · Local Services · Parcel · Community
 *   Sections      Accommodation near you · Popular services ·
 *                 Community updates · Featured businesses (labelled ads)
 *
 * Every section shows a real loading / empty / error state. Sections whose
 * backends ship in later stages render an honest empty state with a working
 * action rather than fabricated listings - the brief forbids presenting sample
 * content as genuine, and forbids dead ends.
 *
 * Home content follows the selected location, which is persisted and seeded
 * from the signed-in profile.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryShortcuts, CategoryId } from '@/components/categories';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { TrustRow } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { Screen, SectionHeader } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { EmptyState, SkeletonCard } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useLocation } from '@/stores/location';
import { useTheme } from '@/theme/use-theme';

/* ---------------------------------------------------------------------------
 * Section definition - one place, so Home and its states stay consistent
 * ------------------------------------------------------------------------ */

type SectionTone = 'primary' | 'secondary' | 'accent' | 'neutral';

/** Row shape returned by GET /rooms for the Home accommodation rail. */
interface HomeRoom {
  id: string;
  title?: string;
  rent?: number;
  currency?: string;
  area?: string | null;
  city?: string | null;
  demoData?: boolean;
}

interface HomeSection {
  id: string;
  title: string;
  subtitle: string;
  tone: SectionTone;
  /** What the section will contain once its stage ships. */
  emptyTitle: string;
  emptyMessage: string;
  emptyAction: { label: string; onPress: () => void };
  /** Sections whose backend is live fetch here instead of showing empty. */
  status: 'empty';
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user, status: authStatus, restoreError, refreshUser } = useAuth();
  const { location, loading: locationLoading } = useLocation();

  const profile = user?.profile;
  const fullName = profile?.fullName ?? 'there';
  const firstName = fullName.split(' ')[0] ?? fullName;

  const locationLabel = useMemo(() => {
    if (location) return `${location.cityName}, ${location.countryIso || location.countryName}`;
    return null;
  }, [location]);

  /* ------------------------------------------------------- live listings */

  const [rooms, setRooms] = useState<HomeRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const cityName = location?.cityName;
      // Public feed; scoped to the selected city when one is set.
      const res = await api.get<HomeRoom[]>('/rooms', {
        query: cityName ? { city: cityName } : undefined,
        auth: false,
      });
      setRooms(res ?? []);
    } catch (err) {
      setRooms([]);
      setRoomsError(
        err instanceof ApiError ? err.message : 'Could not load listings.',
      );
    } finally {
      setRoomsLoading(false);
    }
  }, [location]);

  useEffect(() => {
    // Defer the kick-off so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      void loadRooms();
    });
  }, [loadRooms]);

  const sections: HomeSection[] = useMemo(
    () => [
      {
        id: 'accommodation',
        title: 'Accommodation near you',
        subtitle: location
          ? `Rooms and properties in ${location.cityName}`
          : 'Set your location to see what is nearby',
        tone: 'primary',
        emptyTitle: 'No listings here yet',
        emptyMessage: locationLabel ?? 'Set your location to see accommodation nearby, or browse what is available now.',
        emptyAction: {
          label: 'Browse all rooms',
          onPress: () => router.push('/rooms'),
        },
        status: 'empty',
      },
      {
        id: 'services',
        title: 'Popular services',
        subtitle: 'Beauticians, IT support, tutors, accountants and more',
        tone: 'secondary',
        emptyTitle: 'No services listed yet',
        emptyMessage:
          'Local providers have not published in this area yet. Browse other cities or offer your own service.',
        emptyAction: {
          label: 'Explore services',
          onPress: () => router.push({ pathname: '/(tabs)/explore', params: { category: 'services' } }),
        },
        status: 'empty',
      },
      {
        id: 'community',
        title: 'Community updates',
        subtitle: 'Recent discussions and recommendations nearby',
        tone: 'neutral',
        emptyTitle: 'No discussions yet',
        emptyMessage:
          'Start the first conversation in your city - ask a question or share a local recommendation.',
        emptyAction: {
          label: 'Open community',
          onPress: () => router.push({ pathname: '/(tabs)/explore', params: { category: 'community' } }),
        },
        status: 'empty',
      },
      {
        id: 'sponsored',
        title: 'Featured businesses',
        subtitle: 'Promoted by local partners',
        tone: 'accent',
        emptyTitle: 'No promoted businesses',
        emptyMessage: 'Sponsored placements appear here. Businesses can promote their services from their profile.',
        emptyAction: {
          label: 'Explore services',
          onPress: () => router.push({ pathname: '/(tabs)/explore', params: { category: 'services' } }),
        },
        status: 'empty',
      },
    ],
    [location, locationLabel],
  );

  function openCategory(id: CategoryId) {
    router.push({ pathname: '/(tabs)/explore', params: { category: id } });
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.huge }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------------------------------------------------------- Header */}
        <ScreenHeader
          brand
          subtitle={locationLoading ? 'Finding your location…' : (locationLabel ?? 'Choose your city')}
          actions={[
            {
              icon: 'notifications-outline',
              label: 'Notifications',
              onPress: () => router.push('/notifications'),
              dot: false,
            },
          ]}
          avatar={
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              hitSlop={theme.layout.hitSlop}
            >
              <Avatar
                name={fullName}
                uri={profile?.avatarUrl ?? undefined}
                size={40}
              />
            </Pressable>
          }
        />

        {/* ------------------------------------------- session restore alert */}
        {restoreError ? (
          <Card padding="md" style={{ marginTop: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons
                name="cloud-offline-outline"
                size={18}
                color={theme.colors.warning}
              />
              <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                {restoreError}
              </AppText>
              <Button
                label="Retry"
                variant="outline"
                size="sm"
                onPress={() => void refreshUser()}
              />
            </View>
          </Card>
        ) : null}

        {/* ------------------------------------------------------------ Search */}
        <View style={{ marginTop: theme.spacing.lg }}>
          <SearchBar
            variant="button"
            onPress={() => router.push('/(tabs)/explore')}
            placeholder="What are you looking for?"
            trailing={
              <Pressable
                onPress={() => router.push('/(tabs)/explore')}
                accessibilityRole="button"
                accessibilityLabel="Filters"
                hitSlop={theme.layout.hitSlop}
                style={[
                  styles.filterBtn,
                  { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill },
                ]}
              >
                <Ionicons name="options-outline" size={16} color={theme.colors.textOnPrimary} />
              </Pressable>
            }
          />
        </View>

        {/* -------------------------------------------------- Category tiles */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <CategoryShortcuts onSelect={openCategory} />
        </View>

        {/* ------------------------------------------------------- Greeting */}
        {authStatus === 'authenticated' ? (
          <Card
            padding="lg"
            style={{ marginTop: theme.spacing.xl }}
            elevated
          >
            <View style={styles.greetingRow}>
              <View style={styles.greetingText}>
                <AppText variant="caption" color="textMuted">
                  Welcome back
                </AppText>
                <AppText variant="subheading" style={{ marginTop: 2 }}>
                  {firstName}
                </AppText>
              </View>

              <View
                style={[
                  styles.greetingMark,
                  { backgroundColor: theme.colors.secondaryTint, borderRadius: theme.radius.lg },
                ]}
              >
                <Ionicons name="hand-left-outline" size={26} color={theme.colors.secondary} />
              </View>
            </View>
          </Card>
        ) : (
          <Card padding="lg" style={{ marginTop: theme.spacing.xl }} elevated>
            <AppText variant="subheading">Join your city community</AppText>
            <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xs }}>
              Sign in to save listings, message providers and post to your community.
            </AppText>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Go to profile to sign in"
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <AppText variant="bodyMedium" color="textOnPrimary">
                Get started
              </AppText>
            </Pressable>
          </Card>
        )}

        {/* ------------------------------------------------------- Sections */}
        {sections.map((section) => (
          <View key={section.id} style={{ marginTop: theme.spacing.xxl }}>
            <SectionHeader
              title={section.title}
              subtitle={section.subtitle}
              action={{
                label: 'See all',
                onPress: section.emptyAction.onPress,
              }}
            />

            <Card padding="lg">
              {section.id === 'accommodation' ? (
                roomsLoading ? (
                  <SkeletonCard count={2} />
                ) : roomsError ? (
                  <View>
                    <AppText variant="body" color="danger">
                      {roomsError}
                    </AppText>
                    <Button
                      label="Try again"
                      variant="outline"
                      size="sm"
                      style={{ marginTop: 12 }}
                      onPress={() => void loadRooms()}
                    />
                  </View>
                ) : rooms.length > 0 ? (
                  <View>
                    {rooms.slice(0, 3).map((room, index) => (
                      <Pressable
                        key={room.id}
                        onPress={() =>
                          router.push(`/room-detail?id=${room.id}`)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`View listing: ${room.title ?? ''}`}
                        style={({ pressed }) => ({
                          paddingVertical: 10,
                          borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                          borderColor: theme.colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <AppText
                                variant="bodyMedium"
                                numberOfLines={1}
                                style={{ flexShrink: 1 }}
                              >
                                {room.title ?? 'Listing'}
                              </AppText>
                              <TrustRow
                                isDemo={room.demoData ?? false}
                                size="sm"
                              />
                            </View>
                            <AppText
                              variant="caption"
                              color="textMuted"
                              numberOfLines={1}
                              style={{ marginTop: 2 }}
                            >
                              {[room.area, room.city].filter(Boolean).join(', ') ||
                                locationLabel ||
                                'Location to be confirmed'}
                            </AppText>
                            <AppText
                              variant="bodyMedium"
                              color="primary"
                              style={{ marginTop: 4 }}
                            >
                              {(room.rent ?? 0).toLocaleString()}{' '}
                              {room.currency ?? 'GBP'} / month
                            </AppText>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={theme.colors.textMuted}
                          />
                        </View>
                      </Pressable>
                    ))}
                    <Button
                      label="See all rooms"
                      variant="outline"
                      size="sm"
                      fullWidth
                      style={{ marginTop: 12 }}
                      onPress={() => router.push('/rooms')}
                    />
                  </View>
                ) : (
                  <EmptyState
                    compact
                    icon={sectionToneIcon(section.tone)}
                    title="No listings here yet"
                    message={
                      locationLabel
                        ? `Nothing available in ${location?.cityName} right now - browse every city instead.`
                        : 'Set your location or browse every city to see what is available.'
                    }
                    action={{
                      label: 'Browse all rooms',
                      onPress: () => router.push('/rooms'),
                    }}
                  />
                )
              ) : section.status === 'empty' ? (
                <EmptyState
                  compact
                  icon={sectionToneIcon(section.tone)}
                  title={section.emptyTitle}
                  message={section.emptyMessage}
                  action={section.emptyAction}
                />
              ) : (
                <SkeletonCard count={2} />
              )}
            </Card>

            {/* Ads are always labelled (Prompt.md §15). */}
            {section.id === 'sponsored' ? (
              <AppText
                variant="caption"
                color="textMuted"
                align="center"
                style={{ marginTop: theme.spacing.xs }}
              >
                Promoted content is always labelled as an advertisement.
              </AppText>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function sectionToneIcon(tone: SectionTone): string {
  switch (tone) {
    case 'primary':
      return '⌂';
    case 'secondary':
      return '✦';
    case 'accent':
      return '★';
    case 'neutral':
      return '◌';
  }
}

const styles = StyleSheet.create({
  filterBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingText: {
    flex: 1,
    paddingRight: 12,
  },
  greetingMark: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    marginTop: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
  },
});
