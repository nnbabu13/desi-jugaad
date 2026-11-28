/**=============================================================================
 * Rooms screen (Prompt.md §12)
 *
 * Browse available rooms and properties for rent using the real API.
 * Lists rooms from the marketplace with key details (price, location, type).
 * Taps a room to view details and message the host about availability.
 *
 * Seeds initially from the API; user can filter by city, budget, and type.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BackHeader } from '@/components/layout/back-header';
import { AppText } from '@/components/ui/app-text';
import { TrustRow } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useLocation } from '@/stores/location';
import { useTheme } from '@/theme/use-theme';

interface Room {
  id: string;
  title?: string;
  rent?: number;
  currency?: string;
  accommodationType?: string;
  furnished?: string;
  city?: string;
  area?: string | null;
  rooms?: number;
  /** Seeded/sample listings must show a "Sample" chip (Prompt.md §14/§19). */
  demoData?: boolean;
}

const ACCOMMODATION_TYPES: { value: string; label: string }[] = [
  { value: 'room_shared', label: 'Room in a shared home' },
  { value: 'room_private', label: 'Room with private bathroom' },
  { value: 'entire_flat', label: 'Entire flat' },
  { value: 'shared_house', label: 'Shared house' },
  { value: 'studio', label: 'Studio' },
];

function furnishedLabel(value?: string): string {
  if (value === 'furnished') return 'Furnished';
  if (value === 'part_furnished') return 'Part-furnished';
  return 'Unfurnished';
}

export default function RoomsScreen() {
  const theme = useTheme();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterFurnished, setFilterFurnished] = useState('all');

  const { location } = useLocation();
  // Listings follow the selected location by default; the chip below lets the
  // user drop the scope and browse every city (Home's empty state links here
  // promising exactly that).
  const [scopeToLocation, setScopeToLocation] = useState(true);
  const locationScope = scopeToLocation ? location : null;

  const load = useCallback(
    async (search?: string) => {
      try {
        // The text filter runs SERVER-side (title, description, neighbourhood
        // and city) so it reaches beyond the first 100 rows of the feed.
        const query: Record<string, string> = {};
        if (search) query.q = search;
        if (locationScope) {
          if (locationScope.cityName) query.city = locationScope.cityName;
          if (locationScope.countryIso) query.country = locationScope.countryIso;
        }
        const res = await api.get<Room[]>('/rooms', {
          query: Object.keys(query).length > 0 ? query : undefined,
          auth: false,
        });
        setRooms(res ?? []);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Could not load rooms.',
        );
        setRooms([]);
      } finally {
        setLoading(false);
      }
    },
    [locationScope],
  );

  /** Retry path: event handlers may flip loading before reloading. */
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    void load(filterCity.trim() || undefined);
  }, [load, filterCity]);

  // Debounced server-side search: typing re-queries after a short pause and
  // the list updates in place (the skeleton is only for the first load).
  useEffect(() => {
    const search = filterCity.trim();
    const handle = setTimeout(() => {
      void load(search || undefined);
    }, 350);
    return () => clearTimeout(handle);
  }, [filterCity, load]);

  const filteredRooms = rooms.filter((room) => {
    const matchesType = filterType === 'all' || room.accommodationType === filterType;
    const matchesFurnished =
      filterFurnished === 'all' || room.furnished === filterFurnished;
    return matchesType && matchesFurnished;
  });

  const hasActiveFilters =
    filterCity.trim() !== '' ||
    filterType !== 'all' ||
    filterFurnished !== 'all' ||
    locationScope !== null;
  const clearFilters = () => {
    setFilterCity('');
    setFilterType('all');
    setFilterFurnished('all');
    setScopeToLocation(false);
  };

  const renderRoom = (room: Room) => {
    // Never invent placeholder text: a row without a title is not rendered,
    // and optional fields are simply omitted when absent.
    const title = room.title?.trim();
    if (!title) return null;

    const rent = room.rent ?? 0;
    const currency = room.currency || 'GBP';
    const accType = room.accommodationType || 'room_private';
    const locationLine = [room.area, room.city].filter(Boolean).join(', ');
    const roomsCount = room.rooms;
    const accLabel =
      ACCOMMODATION_TYPES.find((t) => t.value === accType)?.label ?? accType;

    return (
      <Pressable
        key={room.id}
        onPress={() => router.push(`/room-detail?id=${room.id}`)}
        style={{
          padding: 16,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 12,
        }}
        accessibilityRole="button"
        accessibilityLabel={`View room details: ${title}`}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="subheading">{title}</AppText>
            <TrustRow isDemo={room.demoData ?? false} style={{ marginTop: 6 }} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginTop: 4,
              }}
            >
              {locationLine ? (
                <>
                  <Ionicons
                    name="location-outline"
                    size={12}
                    color={theme.colors.textMuted}
                  />
                  <AppText variant="caption" color="textSecondary">
                    {locationLine}
                  </AppText>
                </>
              ) : null}
              {roomsCount ? (
                <>
                  <Ionicons
                    name="people-outline"
                    size={12}
                    color={theme.colors.textMuted}
                  />
                  <AppText variant="caption" color="textSecondary">
                    {roomsCount} person{roomsCount === 1 ? '' : 's'}
                  </AppText>
                </>
              ) : null}
            </View>
            {rent > 0 ? (
              <AppText variant="bodyMedium" style={{ marginTop: 6 }}>
                {rent.toLocaleString()} {currency} / month
              </AppText>
            ) : null}
            <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
              {accLabel}
              {room.furnished ? ` · ${furnishedLabel(room.furnished)}` : ''}
            </AppText>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.textMuted}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top']}
    >
      <BackHeader
        title="Rooms"
        subtitle="Browse available listings"
        fallback="/(tabs)"
      />
      <FlatList
        data={filteredRooms}
        keyExtractor={(room) => room.id}
        renderItem={({ item }) => renderRoom(item)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          <>
        {/* Location scope: on = this city only, off = every city. */}
        {location ? (
          <Pressable
            onPress={() => {
              setLoading(true);
              setScopeToLocation((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: scopeToLocation }}
            accessibilityLabel={
              scopeToLocation
                ? `Showing ${location.cityName}. Tap to browse all cities`
                : 'Browsing all cities. Tap to show only your city'
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: theme.radius.pill,
              backgroundColor: scopeToLocation
                ? theme.colors.primaryTint
                : theme.colors.surface,
              borderWidth: 1,
              borderColor: scopeToLocation ? theme.colors.primary : theme.colors.border,
            }}
          >
            <Ionicons
              name="location-outline"
              size={14}
              color={scopeToLocation ? theme.colors.primary : theme.colors.textMuted}
            />
            <AppText
              variant="caption"
              style={{
                color: scopeToLocation ? theme.colors.primary : theme.colors.textSecondary,
                fontWeight: '600',
              }}
            >
              {scopeToLocation
                ? `${location.cityName}, ${location.countryIso}`
                : 'All cities'}
            </AppText>
            {scopeToLocation ? (
              <Ionicons name="close" size={14} color={theme.colors.primary} />
            ) : null}
          </Pressable>
        ) : null}

        <View style={{ marginTop: location ? 12 : 4 }}>
          <Input
            placeholder="Search rooms, areas or cities"
            value={filterCity}
            onChangeText={setFilterCity}
            autoCapitalize="none"
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <AppText variant="caption" color="textMuted">
            Property type
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 8,
            }}
          >
            {[{ value: 'all', label: 'All types' }, ...ACCOMMODATION_TYPES].map(
              (option) => {
                const active = filterType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setFilterType(option.value)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: theme.radius.pill,
                      backgroundColor: active
                        ? theme.colors.primary
                        : theme.colors.surface,
                      borderWidth: 1,
                      borderColor: active
                        ? theme.colors.primary
                        : theme.colors.border,
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={option.label}
                  >
                    <AppText
                      variant="caption"
                      color={active ? 'textInverse' : 'textSecondary'}
                    >
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              },
            )}
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <AppText variant="caption" color="textMuted">
            Furnished
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 8,
            }}
          >
            {[
              { value: 'all', label: 'Any' },
              { value: 'furnished', label: 'Furnished' },
              { value: 'part_furnished', label: 'Part-furnished' },
              { value: 'unfurnished', label: 'Unfurnished' },
            ].map((option) => {
              const active = filterFurnished === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilterFurnished(option.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: theme.radius.pill,
                    backgroundColor: active
                      ? theme.colors.primary
                      : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: active
                      ? theme.colors.primary
                      : theme.colors.border,
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.label}
                >
                  <AppText
                    variant="caption"
                    color={active ? 'textInverse' : 'textSecondary'}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <AppText variant="subheading">Available rooms</AppText>
          {hasActiveFilters ? (
            <Pressable
              onPress={clearFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
              style={{ marginTop: 6 }}
            >
              <AppText variant="caption" color="primary">
                Clear filters
              </AppText>
            </Pressable>
          ) : null}
        </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonCard count={3} />
          ) : error ? (
            <ErrorState
              title="Could not load rooms"
              message={error}
              onRetry={reload}
            />
          ) : (
            <EmptyState
              title={hasActiveFilters ? 'No rooms match your filters' : 'No rooms available'}
              message={
                hasActiveFilters
                  ? 'Try adjusting or clearing your filters to see more listings.'
                  : 'Listings will appear here as soon as hosts publish them.'
              }
              icon="⌕"
              action={
                hasActiveFilters
                  ? { label: 'Clear filters', onPress: clearFilters }
                  : { label: 'Refresh', onPress: reload }
              }
              secondaryAction={{ label: 'Go to Home', onPress: () => router.replace('/(tabs)') }}
            />
          )
        }
      />
    </SafeAreaView>
  );
}
