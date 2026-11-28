/**
 * ============================================================================
 * Explore (Prompt.md §5)
 * ============================================================================
 *
 * Discovery: category tabs over the listings of the location the user has
 * already chosen (Home header or Profile). The country chips, city grid and
 * location search that used to live here were removed - there is exactly one
 * selected place, so Explore shows that place and nothing else.
 *
 * The Rentals category shows live listings from GET /rooms scoped to the
 * selected country and city; the remaining categories show an honest empty
 * state with a working action until their backends ship.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryTabs, CategoryId, categoryById } from '@/components/categories';
import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText } from '@/components/ui/app-text';
import { Badge, TrustRow } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { EmptyState, SkeletonCard } from '@/components/ui/states';
import { api } from '@/lib/api';
import { postTypeForCategory } from '@/lib/post-types';
import { useQuery } from '@/hooks/use-query';
import { useLocation } from '@/stores/location';
import { useTheme } from '@/theme/use-theme';

/** Row shape returned by GET /rooms for the Rentals category. */
interface ExploreRoom {
  id: string;
  title?: string;
  rent?: number;
  currency?: string;
  area?: string | null;
  city?: string | null;
  accommodationType?: string;
  demoData?: boolean;
}

export default function ExploreScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ category?: string }>();
  const { location } = useLocation();

  const [category, setCategory] = useState<CategoryId | 'all'>('all');

  // Home/Explore deep links can preselect a category.
  useEffect(() => {
    const raw = Array.isArray(params.category) ? params.category[0] : params.category;
    if (!raw) return;
    if (raw === 'all' || ['rentals', 'services', 'parcel', 'community'].includes(raw)) {
      // Deferred so the effect body itself never sets state synchronously.
      Promise.resolve().then(() => {
        setCategory(raw as CategoryId | 'all');
      });
    }
  }, [params.category]);

  /* ------------------------------------------------------------------ data */

  // The one selected place - chosen on Home or in Profile - drives every
  // listing here. Explore no longer offers a country/city browser of its own.
  const cityName = location?.cityName ?? null;
  const countryIso = location?.countryIso ?? null;

  /* ---------------------------------------------------------------- actions */

  /** Opens the post wizard; the listing tabs always post a room. */
  function openPostForCategory(explicit?: CategoryId) {
    const target = explicit ?? (category === 'all' ? 'rentals' : category);
    const type = postTypeForCategory(target);
    router.push({ pathname: '/post-form', params: { type: type.id } });
  }

  /* ------------------------------------------------------------ derived UI */

  const categoryDef = category === 'all' ? null : categoryById(category);
  // "All" has no single category, but rooms are the only live listings, so it
  // shows the same feed as Rentals instead of an empty card.
  const showsListings = category === 'all' || category === 'rentals';
  const listingsDef = categoryById('rentals');
  // Non-null in every branch: listings tabs take the Rentals definition, the
  // remaining tabs always have a concrete category.
  const cardDef = showsListings ? listingsDef : (categoryDef ?? listingsDef);

  // Live listings for the All and Rentals tabs, scoped to the selected country
  // AND city. Both are sent so a city name shared by two countries can never
  // pull the other country's rooms into this feed.
  const roomsQuery = useQuery<ExploreRoom[]>(
    (signal) =>
      api.get<ExploreRoom[]>('/rooms', {
        query: {
          ...(cityName ? { city: cityName } : {}),
          ...(countryIso ? { country: countryIso } : {}),
        },
        auth: false,
        signal,
      }),
    [cityName, countryIso],
    { enabled: showsListings },
  );

  /* ------------------------------------------------------------------ view */

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.huge }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ScreenHeader
          title="Explore"
          subtitle={
            cityName
              ? `Showing ${cityName}`
              : location?.countryName
                ? `Showing ${location.countryName}`
                : 'Choose your city on Home'
          }
        />

          <>
            {/* Category tabs */}
            <View style={{ marginTop: theme.spacing.lg }}>
              <CategoryTabs value={category} onChange={setCategory} />
            </View>

            {/* "All" and Rentals show the live feed for the selected location;
                the remaining categories show an honest empty state with a
                working action until their backends ship. */}
            <Card padding="lg" style={{ marginTop: theme.spacing.lg }}>
              <View style={styles.categoryHead}>
                <Badge
                  label={cardDef.label}
                  tone={cardDef.tint === 'neutral' ? 'neutral' : (cardDef.tint as 'primary' | 'secondary' | 'accent')}
                  /* Badge prints `icon` as literal text, so it needs a glyph,
                     not an Ionicons name (which would render as "home-outline"). */
                  icon={categoryIcon(cardDef.id)}
                />
              </View>

              {showsListings ? (
                roomsQuery.initialLoading ? (
                    <SkeletonCard count={2} />
                  ) : roomsQuery.error ? (
                    <View>
                      <AppText variant="body" color="danger">
                        Could not load listings right now.
                      </AppText>
                      <Button
                        label="Try again"
                        variant="outline"
                        size="sm"
                        style={{ marginTop: 12 }}
                        onPress={roomsQuery.refetch}
                      />
                    </View>
                  ) : (roomsQuery.data?.length ?? 0) > 0 ? (
                    <View>
                      {roomsQuery.data!.slice(0, 6).map((room, index) => (
                        <Pressable
                          key={room.id}
                          onPress={() => router.push(`/room-detail?id=${room.id}`)}
                          accessibilityRole="button"
                          accessibilityLabel={`View listing: ${room.title ?? ''}`}
                          style={({ pressed }) => ({
                            paddingVertical: 10,
                            borderTopWidth:
                              index === 0 ? 0 : StyleSheet.hairlineWidth,
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
                      icon={categoryIcon(cardDef.id)}
                      title={
                        cityName
                          ? `No rentals in ${cityName} yet`
                          : 'No rentals here yet'
                      }
                      message={
                        cityName
                          ? `Nothing published in ${cityName} so far. Browse every city, or post the first room.`
                          : 'Nothing published in this country so far. Browse every city, or post the first room.'
                      }
                      action={{
                        label: 'Browse all rooms',
                        onPress: () => router.push('/rooms'),
                      }}
                      secondaryAction={{
                        label: 'Post a room',
                        onPress: () => openPostForCategory('rentals'),
                      }}
                    />
                  )
                ) : (
                  <EmptyState
                    compact
                    icon={categoryIcon(cardDef.id)}
                    title={`No ${cardDef.shortLabel.toLowerCase()} here yet`}
                    message={
                      cityName
                        ? `Nothing published in ${cityName} so far. Be the first, or browse another city.`
                        : `Nothing published in ${location?.countryName ?? 'this country'} so far.`
                    }
                    action={{
                      label: `Post ${cardDef.shortLabel.toLowerCase()}`,
                      onPress: () => openPostForCategory(),
                    }}
                  />
                )}
            </Card>

          </>
      </ScrollView>
    </Screen>
  );
}

/* --------------------------------------------------------------------------- *
 * Sub-components
 * ------------------------------------------------------------------------ */

function categoryIcon(id: CategoryId): string {
  switch (id) {
    case 'rentals':
      return '⌂';
    case 'services':
      return '✦';
    case 'parcel':
      return '✈';
    case 'community':
      return '◌';
  }
}

/* --------------------------------------------------------------------------- *
 * Styles
 * ------------------------------------------------------------------------ */

const styles = StyleSheet.create({
  categoryHead: {
    marginBottom: 4,
  },
});
