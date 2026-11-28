/**
 * LocationPickerSheet - choose the country and city Home should follow.
 *
 * Prompt.md §4: "Home content should change according to the user's selected
 * country and city." The header subtitle on Home is the entry point to this
 * sheet; the same choice is also reachable from Profile (ProfileEditSheet) and
 * Explore, so all three write through the single location store and - when a
 * session exists - keep the server-side profile in step.
 *
 * Mounted fresh on every open (the parent renders it conditionally), so the
 * country/city state can be seeded straight from the stored selection.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Input } from '@/components/ui/input';
import { geographyApi } from '@/lib/geography';
import { useAuth } from '@/stores/auth';
import { SelectedLocation, useLocation } from '@/stores/location';
import { useTheme } from '@/theme/use-theme';

interface PickerItem {
  id: string;
  label: string;
  hint?: string;
  flagEmoji?: string | null;
}

interface PickedCountry {
  id: string;
  name: string;
  isoCode?: string;
  flagEmoji?: string | null;
}

export interface LocationPickerSheetProps {
  onClose: () => void;
}

export function LocationPickerSheet({ onClose }: LocationPickerSheetProps) {
  const theme = useTheme();
  const { location, setLocation } = useLocation();
  const { status: authStatus, updateProfile } = useAuth();

  const [country, setCountry] = useState<PickedCountry | null>(() =>
    location
      ? {
          id: location.countryId,
          name: location.countryName,
          isoCode: location.countryIso,
          flagEmoji: location.countryFlag,
        }
      : null,
  );
  const [city, setCity] = useState<{ id: string; name: string } | null>(() =>
    location ? { id: location.cityId, name: location.cityName } : null,
  );

  // Country / city list overlay state.
  const [picker, setPicker] = useState<'country' | 'city' | null>(null);
  const [countries, setCountries] = useState<PickerItem[]>([]);
  const [cities, setCities] = useState<PickerItem[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  /* ----------------------------- pickers ------------------------------ */

  const openCountryPicker = () => {
    setQuery('');
    setGeoError(null);
    setPicker('country');
    if (countries.length > 0) return;
    setGeoLoading(true);
    geographyApi
      .countries({ limit: 300 })
      .then((res) => {
        setCountries(
          (res.items ?? []).map((c) => ({
            id: c.id,
            label: c.name,
            hint: c.isoCode,
            flagEmoji: c.flagEmoji,
          })),
        );
      })
      .catch(() => setGeoError('Could not load countries.'))
      .finally(() => setGeoLoading(false));
  };

  const openCityPicker = () => {
    if (!country) return;
    setQuery('');
    setGeoError(null);
    setPicker('city');
    setGeoLoading(true);
    geographyApi
      .cities(country.id, { limit: 300 })
      .then((res) => {
        setCities(
          (res.items ?? []).map((c) => ({
            id: c.id,
            label: c.name,
            hint: c.region ?? undefined,
          })),
        );
      })
      .catch(() => setGeoError('Could not load cities.'))
      .finally(() => setGeoLoading(false));
  };

  const closePicker = () => {
    setPicker(null);
    setGeoError(null);
    setQuery('');
  };

  const pickCountry = (item: PickerItem) => {
    if (item.id !== country?.id) {
      // A city from the old country can never belong to the new one.
      setCity(null);
      setCities([]);
      setCountry({
        id: item.id,
        name: item.label,
        isoCode: item.hint,
        flagEmoji: null,
      });
    }
    closePicker();
  };

  const pickCity = async (item: PickerItem) => {
    if (!country) return;
    const next: SelectedLocation = {
      countryId: country.id,
      countryName: country.name,
      countryIso: country.isoCode ?? '',
      countryFlag: country.flagEmoji ?? null,
      cityId: item.id,
      cityName: item.label,
    };

    setCity({ id: item.id, name: item.label });
    closePicker();

    setSaving(true);
    try {
      // The local store first so Home repaints immediately, then best-effort
      // sync of the server-side profile when there is a session.
      await setLocation(next);
      if (authStatus === 'authenticated') {
        try {
          await updateProfile({
            currentCountryId: country.id,
            currentCityId: item.id,
          });
        } catch {
          // The local selection still applies; the profile can sync later.
        }
      }
    } finally {
      setSaving(false);
      onClose();
    }
  };

  /* ------------------------------ render ----------------------------- */

  const pickerItems = picker === 'country' ? countries : cities;
  const needle = query.trim().toLowerCase();
  const filteredItems = needle
    ? pickerItems.filter((item) => item.label.toLowerCase().includes(needle))
    : pickerItems;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close location picker"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">Choose your city</AppText>
                <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                  Home shows listings from this place
                </AppText>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                style={[styles.iconBtn, { backgroundColor: theme.colors.surfaceSunken }]}
              >
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.rows}>
              <Pressable
                onPress={openCountryPicker}
                accessibilityRole="button"
                accessibilityLabel="Select country"
                style={({ pressed }) => [
                  styles.selectRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="globe-outline" size={18} color={theme.colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color="textMuted">
                    Country
                  </AppText>
                  <AppText variant="bodyMedium" numberOfLines={1} style={{ marginTop: 1 }}>
                    {country ? country.name : 'Not set'}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>

              <Pressable
                onPress={country ? openCityPicker : openCountryPicker}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Select city"
                style={({ pressed }) => [
                  styles.selectRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    marginTop: 10,
                    opacity: saving ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="location-outline" size={18} color={theme.colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color="textMuted">
                    City
                  </AppText>
                  <AppText variant="bodyMedium" numberOfLines={1} style={{ marginTop: 1 }}>
                    {city ? city.name : country ? 'Not set' : 'Pick a country first'}
                  </AppText>
                </View>
                {saving ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                )}
              </Pressable>
            </View>

            <AppText variant="caption" color="textMuted" style={styles.hint}>
              Your choice is saved to your profile and remembered on this device.
            </AppText>
          </View>
        </KeyboardAvoidingView>

        {/* Country / city list - rendered above the sheet while open. */}
        {picker ? (
          <View style={[styles.picker, { backgroundColor: theme.colors.background }]}>
            <View style={styles.pickerHeader}>
              <Pressable
                onPress={closePicker}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={10}
                style={[styles.iconBtn, { backgroundColor: theme.colors.surfaceSunken }]}
              >
                <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
              </Pressable>
              <AppText variant="subheading" style={{ flex: 1, marginLeft: 10 }}>
                {picker === 'country' ? 'Select country' : `Cities in ${country?.name ?? ''}`}
              </AppText>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder={picker === 'country' ? 'Search countries…' : 'Search cities…'}
                autoCapitalize="none"
              />
            </View>

            {geoLoading ? (
              <View style={styles.pickerState}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <AppText variant="caption" color="textMuted" style={{ marginTop: 8 }}>
                  Loading…
                </AppText>
              </View>
            ) : geoError ? (
              <View style={styles.pickerState}>
                <AppText variant="caption" color="danger">
                  {geoError}
                </AppText>
                <Pressable
                  onPress={picker === 'country' ? openCountryPicker : openCityPicker}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  style={{ marginTop: 10 }}
                >
                  <AppText variant="bodyMedium" color="primary">
                    Try again
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                ListEmptyComponent={
                  <View style={styles.pickerState}>
                    <AppText variant="body" color="textMuted">
                      No matches.
                    </AppText>
                  </View>
                }
                renderItem={({ item }) => {
                  const isSelected =
                    (picker === 'country' ? country?.id : city?.id) === item.id;
                  return (
                    <Pressable
                      onPress={() => (picker === 'country' ? pickCountry(item) : void pickCity(item))}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      style={({ pressed }) => [
                        styles.pickerItem,
                        {
                          backgroundColor: pressed
                            ? theme.colors.surfaceSunken
                            : theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.itemLabelRow}>
                          {item.flagEmoji ? (
                            <AppText variant="bodyMedium">{item.flagEmoji}</AppText>
                          ) : null}
                          <AppText variant="bodyMedium" style={{ flexShrink: 1 }}>
                            {item.label}
                          </AppText>
                        </View>
                        {item.hint ? (
                          <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                            {item.hint}
                          </AppText>
                        ) : null}
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={theme.colors.textMuted}
                        />
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 37, 0.55)',
  },
  sheetWrap: {
    maxHeight: '94%',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  rows: {
    paddingHorizontal: 16,
  },
  hint: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  picker: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    paddingTop: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pickerState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  itemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

export default LocationPickerSheet;
