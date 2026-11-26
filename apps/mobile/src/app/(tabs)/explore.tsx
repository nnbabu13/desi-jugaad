/**
 * ============================================================================
 * Explore (Prompt.md §5)
 * ============================================================================
 *
 * Unified discovery: search, country and city selectors, category tabs, and
 * a grid/list switch - all backed by the live geography API.
 *
 * Choosing a city here is a real action: it persists to the device, updates
 * the signed-in profile when there is one, and Home re-renders around it.
 *
 * The Rentals category shows live listings from GET /rooms (scoped to the
 * chosen city); the remaining categories show an honest empty state with a
 * working action until their backends ship.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryTabs, CategoryId, categoryById } from '@/components/categories';
import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText } from '@/components/ui/app-text';
import { Badge, TrustRow } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SearchBar } from '@/components/ui/search-bar';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/states';
import { City, CityWithCountry, Country } from '@/lib/api-types';
import { api } from '@/lib/api';
import { geographyApi } from '@/lib/geography';
import { postTypeForCategory } from '@/lib/post-types';
import { useQuery } from '@/hooks/use-query';
import { useAuth } from '@/stores/auth';
import { useLocation, SelectedLocation } from '@/stores/location';
import { useTheme } from '@/theme/use-theme';

type SortKey = 'popular' | 'az';
type LayoutKey = 'grid' | 'list';

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

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 350;

export default function ExploreScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const { location, setLocation } = useLocation();
  const { status: authStatus, updateProfile } = useAuth();

  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [debounced, setDebounced] = useState(query.trim());
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [countryIso, setCountryIso] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('popular');
  const [layout, setLayout] = useState<LayoutKey>('grid');
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Debounce the search field.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const searching = debounced.length >= SEARCH_MIN_CHARS;

  /* ------------------------------------------------------------------ data */

  const countriesQuery = useQuery<CountryListResult>(
    (signal) => geographyApi.countries({ limit: 300 }, signal),
    [],
  );

  const countries = useMemo(
    () => countriesQuery.data?.items ?? [],
    [countriesQuery.data],
  );

  // Default the selector to the saved location, else the first country.
  useEffect(() => {
    if (countryIso || countries.length === 0) return;
    const saved = location?.countryIso
      ? countries.find((c) => c.isoCode === location.countryIso)
      : undefined;
    // Deferred so the effect body itself never sets state synchronously.
    const iso = (saved ?? countries[0]).isoCode;
    Promise.resolve().then(() => {
      setCountryIso(iso);
    });
  }, [countries, countryIso, location?.countryIso]);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.isoCode === countryIso) ?? null,
    [countries, countryIso],
  );

  const citiesQuery = useQuery(
    (signal) => geographyApi.cities(countryIso ?? '', {}, signal),
    [countryIso],
    { enabled: Boolean(countryIso) },
  );

  const searchQuery = useQuery(
    (signal) => geographyApi.searchLocations(debounced, 20, signal),
    [debounced],
    { enabled: searching },
  );

  /* ---------------------------------------------------------------- actions */

  async function chooseCity(
    city: { id: string; name: string },
    country: { id: string; isoCode: string; name: string; flagEmoji: string | null },
  ) {
    const next: SelectedLocation = {
      countryId: country.id,
      countryName: country.name,
      countryIso: country.isoCode,
      countryFlag: country.flagEmoji ?? null,
      cityId: city.id,
      cityName: city.name,
    };

    await setLocation(next);
    setSelectedCityName(city.name);
    setNotice(`${city.name} is now your city`);

    // Keep the server-side profile in step when there is a session.
    if (authStatus === 'authenticated') {
      try {
        await updateProfile({
          currentCountryId: country.id,
          currentCityId: city.id,
        });
      } catch {
        // The local selection still applies; the profile sync can retry later.
      }
    }
  }

  async function chooseSearchCity(city: CityWithCountry) {
    await chooseCity(city, {
      id: city.country.id,
      isoCode: city.country.isoCode,
      name: city.country.name,
      flagEmoji: city.country.flagEmoji,
    });
    setQuery('');
    setDebounced('');
    setCountryIso(city.country.isoCode);
  }

  function chooseSearchCountry(country: {
    id: string;
    isoCode: string;
    name: string;
    flagEmoji: string | null;
  }) {
    setCountryIso(country.isoCode);
    setQuery('');
    setDebounced('');
  }

  function openPostForCategory() {
    if (category === 'all') return;
    const type = postTypeForCategory(category);
    router.push({ pathname: '/post-form', params: { type: type.id } });
  }

  /* ------------------------------------------------------------ derived UI */

  const categoryDef = category === 'all' ? null : categoryById(category);
  const cityName = selectedCityName ?? location?.cityName ?? null;

  // Live listings for the Rentals category, scoped to the chosen city.
  const roomsQuery = useQuery<ExploreRoom[]>(
    (signal) =>
      api.get<ExploreRoom[]>('/rooms', {
        query: cityName ? { city: cityName } : undefined,
        auth: false,
        signal,
      }),
    [cityName],
    { enabled: category === 'rentals' },
  );

  const sortedCities = useMemo(() => {
    const list = [...(citiesQuery.data?.items ?? [])];
    if (sort === 'az') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => {
        const score = (c: City) => (c.isFeatured ? 2 : 0) + (c.isLaunch ? 1 : 0);
        const diff = score(b) - score(a);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [citiesQuery.data, sort]);

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
              : selectedCountry
                ? `Showing ${selectedCountry.name}`
                : 'Search cities, countries and categories'
          }
        />

        {/* ---------------------------------------------------------- Search */}
        <View style={{ marginTop: theme.spacing.lg }}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search a city or country"
            autoCorrect={false}
            returnKeyType="search"
            trailing={
              query.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setDebounced('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={theme.layout.hitSlop}
                >
                  <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                </Pressable>
              ) : undefined
            }
          />
        </View>

        {searching ? (
          /* ------------------------------------------------- Search results */
          <View style={{ marginTop: theme.spacing.xl }}>
            <AppText variant="caption" color="textMuted" style={styles.blockLabel}>
              RESULTS FOR “{debounced.toUpperCase()}”
            </AppText>

            {searchQuery.loading ? (
              <SkeletonCard count={3} />
            ) : searchQuery.error ? (
              <ErrorState
                compact
                onRetry={searchQuery.refetch}
                secondaryAction={{ label: 'Clear search', onPress: () => setQuery('') }}
              />
            ) : (searchQuery.data?.total ?? 0) === 0 ? (
              <EmptyState
                compact
                icon="⌕"
                title="No places match that"
                message="Try a different spelling, or browse the countries below."
                action={{ label: 'Clear search', onPress: () => setQuery('') }}
              />
            ) : (
              <>
                {searchQuery.data?.countries.map((country) => (
                  <Card
                    key={`c-${country.id}`}
                    padding="md"
                    style={styles.resultCard}
                    onPress={() => chooseSearchCountry(country)}
                    accessibilityLabel={`Show cities in ${country.name}`}
                  >
                    <ResultRow
                      flag={country.flagEmoji}
                      title={country.name}
                      subtitle={country.currencyCode ? `${country.isoCode} · ${country.currencyCode}` : country.isoCode}
                    />
                  </Card>
                ))}

                {searchQuery.data?.cities.map((city) => (
                  <Card
                    key={`city-${city.id}`}
                    padding="md"
                    style={styles.resultCard}
                    onPress={() => chooseSearchCity(city)}
                    accessibilityLabel={`Set ${city.name} as your city`}
                  >
                    <ResultRow
                      flag={city.country.flagEmoji}
                      title={city.name}
                      subtitle={[city.region, city.country.name].filter(Boolean).join(', ')}
                      badge={city.isLaunch ? 'Launch city' : undefined}
                    />
                  </Card>
                ))}
              </>
            )}
          </View>
        ) : (
          /* ------------------------------------------------------ Browsing */
          <>
            {/* Category tabs */}
            <View style={{ marginTop: theme.spacing.lg }}>
              <CategoryTabs value={category} onChange={setCategory} />
            </View>

            {/* Country selector */}
            <AppText variant="caption" color="textMuted" style={styles.blockLabel}>
              COUNTRY
            </AppText>

            {countriesQuery.loading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.chipSkeleton,
                      { backgroundColor: theme.colors.skeleton, borderRadius: theme.radius.pill },
                    ]}
                  />
                ))}
              </ScrollView>
            ) : countriesQuery.error ? (
              <ErrorState
                compact
                onRetry={countriesQuery.refetch}
                secondaryAction={{ label: 'Go to Home', onPress: () => router.push('/(tabs)') }}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {countries.map((country) => {
                  const active = country.isoCode === countryIso;
                  return (
                    <Pressable
                      key={country.id}
                      onPress={() => setCountryIso(country.isoCode)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={country.name}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                          borderColor: active ? theme.colors.primary : theme.colors.border,
                          borderRadius: theme.radius.pill,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <AppText variant="caption" style={{ marginRight: 6 }}>
                        {country.flagEmoji ?? ''}
                      </AppText>
                      <AppText
                        variant="caption"
                        style={{
                          color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary,
                          fontWeight: active ? '700' : '500',
                        }}
                      >
                        {country.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Controls */}
            <View style={styles.controls}>
              <View style={styles.sortGroup}>
                {(['popular', 'az'] as SortKey[]).map((key) => {
                  const active = sort === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSort(key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={key === 'popular' ? 'Sort by popular' : 'Sort alphabetically'}
                      style={({ pressed }) => [
                        styles.sortChip,
                        {
                          backgroundColor: active ? theme.colors.primaryTint : 'transparent',
                          borderRadius: theme.radius.pill,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        style={{
                          color: active ? theme.colors.primary : theme.colors.textMuted,
                          fontWeight: active ? '700' : '500',
                        }}
                      >
                        {key === 'popular' ? 'Popular' : 'A–Z'}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.layoutGroup, { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.pill }]}>
                {(['grid', 'list'] as LayoutKey[]).map((key) => {
                  const active = layout === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setLayout(key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={key === 'grid' ? 'Grid view' : 'List view'}
                      style={({ pressed }) => [
                        styles.layoutBtn,
                        {
                          backgroundColor: active ? theme.colors.surface : 'transparent',
                          borderRadius: theme.radius.pill,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name={key === 'grid' ? 'grid-outline' : 'list-outline'}
                        size={16}
                        color={active ? theme.colors.primary : theme.colors.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Category context: Rentals shows live listings; the rest show
                an honest empty state with a working action until their
                backends ship. */}
            {categoryDef ? (
              <Card padding="lg" style={{ marginTop: theme.spacing.lg }}>
                <View style={styles.categoryHead}>
                  <Badge
                    label={categoryDef.label}
                    tone={categoryDef.tint === 'neutral' ? 'neutral' : (categoryDef.tint as 'primary' | 'secondary' | 'accent')}
                    icon={categoryDef.icon}
                  />
                </View>

                {categoryDef.id === 'rentals' ? (
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
                      icon={categoryIcon(categoryDef.id)}
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
                        label: `Post ${categoryDef.shortLabel.toLowerCase()}`,
                        onPress: openPostForCategory,
                      }}
                    />
                  )
                ) : (
                  <EmptyState
                    compact
                    icon={categoryIcon(categoryDef.id)}
                    title={`No ${categoryDef.shortLabel.toLowerCase()} here yet`}
                    message={
                      cityName
                        ? `Nothing published in ${cityName} so far. Be the first, or browse another city.`
                        : `Nothing published in ${selectedCountry?.name ?? 'this country'} so far.`
                    }
                    action={{
                      label: `Post ${categoryDef.shortLabel.toLowerCase()}`,
                      onPress: openPostForCategory,
                    }}
                  />
                )}
              </Card>
            ) : null}

            {/* Notice after choosing a city */}
            {notice ? (
              <Card padding="md" elevated style={{ marginTop: theme.spacing.lg }}>
                <View style={styles.noticeRow}>
                  <Ionicons name="location" size={18} color={theme.colors.secondary} />
                  <AppText variant="body" style={{ flex: 1, marginLeft: 8 }}>
                    Home now shows {notice.replace(' is now your city', '')}.
                  </AppText>
                  <Pressable
                    onPress={() => router.push('/(tabs)')}
                    accessibilityRole="button"
                    accessibilityLabel="Go to Home"
                    hitSlop={theme.layout.hitSlop}
                  >
                    <AppText variant="label" color="primary">
                      Home
                    </AppText>
                  </Pressable>
                </View>
              </Card>
            ) : null}

            {/* City results */}
            <View style={styles.citiesHead}>
              <AppText variant="caption" color="textMuted" style={styles.blockLabel}>
                CITIES{selectedCountry ? ` IN ${selectedCountry.name.toUpperCase()}` : ''}
              </AppText>
              {citiesQuery.data ? (
                <AppText variant="caption" color="textMuted">
                  {citiesQuery.data.total}
                </AppText>
              ) : null}
            </View>

            {citiesQuery.loading ? (
              <SkeletonCard count={3} />
            ) : citiesQuery.error ? (
              <ErrorState compact onRetry={citiesQuery.refetch} />
            ) : sortedCities.length === 0 ? (
              <EmptyState
                compact
                icon="◎"
                title="No cities loaded for this country"
                message="Pick another country above to see its cities."
                action={{ label: 'Show all countries', onPress: () => setCountryIso(countries[0]?.isoCode ?? null) }}
              />
            ) : layout === 'grid' ? (
              <View style={styles.grid}>
                {sortedCities.map((city) => (
                  <CityCard
                    key={city.id}
                    city={city}
                    flag={selectedCountry?.flagEmoji ?? null}
                    selected={city.id === location?.cityId}
                    layout="grid"
                    onPress={() =>
                      selectedCountry &&
                      chooseCity(city, {
                        id: selectedCountry.id,
                        isoCode: selectedCountry.isoCode,
                        name: selectedCountry.name,
                        flagEmoji: selectedCountry.flagEmoji,
                      })
                    }
                  />
                ))}
              </View>
            ) : (
              <View>
                {sortedCities.map((city) => (
                  <CityCard
                    key={city.id}
                    city={city}
                    flag={selectedCountry?.flagEmoji ?? null}
                    selected={city.id === location?.cityId}
                    layout="list"
                    onPress={() =>
                      selectedCountry &&
                      chooseCity(city, {
                        id: selectedCountry.id,
                        isoCode: selectedCountry.isoCode,
                        name: selectedCountry.name,
                        flagEmoji: selectedCountry.flagEmoji,
                      })
                    }
                  />
                ))}
              </View>
            )}

            <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: theme.spacing.lg }}>
              Tap a city to make it your location. Listings open as each marketplace launches.
            </AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* --------------------------------------------------------------------------- *
 * Sub-components
 * ------------------------------------------------------------------------ */

function ResultRow({
  flag,
  title,
  subtitle,
  badge,
}: {
  flag?: string | null;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.resultRow}>
      <View
        style={[
          styles.resultFlag,
          { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md },
        ]}
      >
        <AppText variant="subheading">{flag ?? '◎'}</AppText>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 2 }}>
          {subtitle}
        </AppText>
        {badge ? (
          <View style={{ marginTop: 6 }}>
            <Badge label={badge} tone="secondary" size="sm" />
          </View>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </View>
  );
}

function CityCard({
  city,
  flag,
  selected,
  layout,
  onPress,
}: {
  city: City;
  flag: string | null;
  selected: boolean;
  layout: LayoutKey;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isGrid = layout === 'grid';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${city.name}. ${selected ? 'Current city' : 'Tap to set as your city'}`}
      style={({ pressed }) => [
        isGrid ? styles.gridCard : styles.listCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: selected ? theme.colors.secondary : theme.colors.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.85 : 1,
        },
        theme.shadow.sm,
      ]}
    >
      <View style={styles.cityHead}>
        <AppText variant="subheading" style={{ fontSize: 18 }}>
          {flag ?? '◎'}
        </AppText>
        {selected ? (
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.secondary} />
        ) : null}
      </View>

      <AppText variant="bodyMedium" numberOfLines={1} style={{ marginTop: 8 }}>
        {city.name}
      </AppText>

      {city.region ? (
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 2 }}>
          {city.region}
        </AppText>
      ) : null}

      <View style={styles.cityBadges}>
        {city.isLaunch ? <Badge label="Launch city" tone="secondary" size="sm" /> : null}
        {city.isFeatured ? <Badge label="Featured" tone="accent" size="sm" /> : null}
        {!city.isLaunch && !city.isFeatured ? (
          <AppText variant="caption" color="textMuted">
            {selected ? 'Your city' : 'Set as your city'}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

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
 * Local response shapes
 * ------------------------------------------------------------------------ */

interface CountryListResult {
  items: Country[];
  total: number;
}

/* --------------------------------------------------------------------------- *
 * Styles
 * ------------------------------------------------------------------------ */

const styles = StyleSheet.create({
  blockLabel: {
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  resultCard: {
    marginBottom: 10,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultFlag: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipSkeleton: {
    width: 96,
    height: 36,
    marginRight: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  sortGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  layoutGroup: {
    flexDirection: 'row',
    padding: 3,
  },
  layoutBtn: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHead: {
    marginBottom: 4,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  citiesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  gridCard: {
    width: '48.5%',
    padding: 14,
    minHeight: 132,
  },
  listCard: {
    width: '100%',
    padding: 14,
    marginBottom: 10,
  },
  cityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    alignItems: 'center',
  },
});
