/**
 * ============================================================================
 * ProfileEditSheet - the edit form behind the profile tab
 * ============================================================================
 *
 * One sheet at a time (form -> optional picker overlay), driven entirely by
 * real API data:
 *   - location uses GET /countries and GET /countries/:id/cities, never a
 *     hardcoded shortlist, and always sends UUIDs (the API rejects names);
 *   - saving goes through the auth store's updateProfile, so the profile
 *     re-renders from the server response instead of needing a reload;
 *   - when the country/city actually changed, the location store is synced
 *     too, so Home re-derives around the new city immediately.
 *
 * Policy: no verification controls here - badges are derived elsewhere and
 * never fabricated (badge.tsx).
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
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import type { UpdateProfileInput } from '@/lib/api-types';
import { geographyApi } from '@/lib/geography';
import { useAuth } from '@/stores/auth';
import { useLocation } from '@/stores/location';
import { useTheme } from '@/theme/use-theme';

/* ---------------------------------------------------------------------------
 * Options (mirror the API's users.dto.ts enums exactly)
 * ------------------------------------------------------------------------ */

const LIFE_STAGE_OPTIONS = [
  { value: 'living_abroad', label: 'Living abroad' },
  { value: 'student_abroad', label: 'Student abroad' },
  { value: 'planning_to_move', label: 'Planning to move' },
  { value: 'other', label: 'Other' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', hint: 'Anyone can view your profile' },
  { value: 'connections', label: 'Connections', hint: 'Only people you connect with' },
  { value: 'private', label: 'Private', hint: 'Hidden from other members' },
] as const;

type Visibility = (typeof VISIBILITY_OPTIONS)[number]['value'];

interface PickedPlace {
  id: string;
  name: string;
  isoCode?: string;
  flagEmoji?: string | null;
}

interface PickerItem {
  id: string;
  label: string;
  hint?: string;
}

/* ---------------------------------------------------------------------------
 * Chip - selectable pill used for life stage, visibility and languages
 * ------------------------------------------------------------------------ */

function Chip({
  label,
  selected,
  onPress,
  onRemove,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onRemove ? `Remove ${label}` : label}
      accessibilityState={{ selected: selected ?? false }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceSunken,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <AppText
        variant="caption"
        color={selected ? 'textInverse' : 'textSecondary'}
        style={styles.chipLabel}
      >
        {label}
      </AppText>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          style={styles.chipRemove}
        >
          <Ionicons name="close" size={12} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/* ---------------------------------------------------------------------------
 * ProfileEditSheet
 * ------------------------------------------------------------------------ */

export interface ProfileEditSheetProps {
  onClose: () => void;
}

export function ProfileEditSheet({ onClose }: ProfileEditSheetProps) {
  const theme = useTheme();
  const { user, updateProfile } = useAuth();
  const { setLocation } = useLocation();

  const profile = user?.profile;
  const originalCountry = profile?.currentCountry ?? null;
  const originalCity = profile?.currentCity ?? null;

  // Form state - seeded once from the profile when the sheet mounts.
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [lifeStage, setLifeStage] = useState<string | null>(profile?.lifeStage ?? null);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [languageDraft, setLanguageDraft] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(
    (profile?.profileVisibility as Visibility | undefined) ?? 'public',
  );
  const [country, setCountry] = useState<PickedPlace | null>(
    originalCountry
      ? {
          id: originalCountry.id,
          name: originalCountry.name,
          isoCode: originalCountry.isoCode,
          flagEmoji: originalCountry.flagEmoji,
        }
      : null,
  );
  const [city, setCity] = useState<PickedPlace | null>(
    originalCity ? { id: originalCity.id, name: originalCity.name } : null,
  );

  // Submission state.
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Picker overlay state (country / city list loaded from the API).
  const [picker, setPicker] = useState<'country' | 'city' | null>(null);
  const [countries, setCountries] = useState<PickerItem[]>([]);
  const [cities, setCities] = useState<PickerItem[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  /* ----------------------------- pickers ------------------------------ */

  const openCountryPicker = () => {
    setQuery('');
    setPicker('country');
    if (countries.length > 0) return;
    setGeoLoading(true);
    setGeoError(null);
    geographyApi
      .countries({ limit: 300 })
      .then((res) => {
        setCountries(
          (res.items ?? []).map((c) => ({
            id: c.id,
            label: c.name,
            hint: c.isoCode,
          })),
        );
      })
      .catch(() => setGeoError('Could not load countries.'))
      .finally(() => setGeoLoading(false));
  };

  const openCityPicker = () => {
    if (!country) return;
    setQuery('');
    setPicker('city');
    setGeoLoading(true);
    setGeoError(null);
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
  };

  const pickCountry = (item: PickerItem) => {
    if (item.id !== country?.id) {
      // A city from the old country can never belong to the new one.
      setCity(null);
      setCities([]);
    }
    const source = countries.find((c) => c.id === item.id);
    setCountry({
      id: item.id,
      name: item.label,
      isoCode: source?.hint,
      flagEmoji: null,
    });
    closePicker();
  };

  const pickCity = (item: PickerItem) => {
    setCity({ id: item.id, name: item.label });
    closePicker();
  };

  /* ------------------------------ chips ------------------------------- */

  const addLanguages = () => {
    const tokens = languageDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    setLanguages((prev) => {
      const seen = new Set(prev.map((l) => l.toLowerCase()));
      const next = [...prev];
      for (const token of tokens) {
        if (!seen.has(token.toLowerCase())) {
          seen.add(token.toLowerCase());
          next.push(token);
        }
      }
      return next;
    });
    setLanguageDraft('');
  };

  /* ------------------------------- save ------------------------------- */

  const onSave = async () => {
    setFormError(null);

    const name = fullName.trim();
    if (!name) {
      setFormError('Enter your name.');
      return;
    }

    const url = avatarUrl.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) {
      setFormError('Photo link must start with http:// or https://.');
      return;
    }

    const countryChanged = (country?.id ?? null) !== (originalCountry?.id ?? null);
    const cityChanged = (city?.id ?? null) !== (originalCity?.id ?? null);

    if (countryChanged && !city) {
      setFormError('Choose a city for the new country.');
      return;
    }

    const input: UpdateProfileInput = {
      fullName: name,
      bio: bio.trim(),
      lifeStage,
      languages,
      profileVisibility: visibility,
      avatarUrl: url || null,
    };

    // Only send location when it actually changed: sending a country without
    // its city is rejected server-side, and untouched fields stay untouched.
    if (countryChanged) {
      input.currentCountryId = country!.id;
      input.currentCityId = city!.id;
    } else if (cityChanged) {
      input.currentCityId = city!.id;
    }

    setSaving(true);
    try {
      await updateProfile(input);

      // Keep Home's location store in step with the saved profile.
      if ((countryChanged || cityChanged) && country && city) {
        await setLocation({
          countryId: country.id,
          countryName: country.name,
          countryIso: country.isoCode ?? '',
          countryFlag: country.flagEmoji ?? null,
          cityId: city.id,
          cityName: city.name,
        });
      }

      onClose();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Could not save changes. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ render ------------------------------ */

  const pickerItems = picker === 'country' ? countries : cities;
  const filteredItems = query.trim()
    ? pickerItems.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : pickerItems;

  return (
    // Rendered in a Modal portal: it sits above the tab bar and can never be
    // shifted by an ancestor container scrolling underneath it.
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
      {/* Backdrop dismisses the sheet. */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close edit profile"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View>
              <AppText variant="heading">Edit profile</AppText>
              <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                Shown to hosts and other members
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

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Input
              label="Full name"
              required
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Priya Sharma"
              autoCapitalize="words"
              maxLength={80}
            />

            <Input
              label="Bio"
              optional
              value={bio}
              onChangeText={setBio}
              placeholder="A line about you - who you are, what you're looking for."
              multiline
              maxLength={400}
              containerStyle={styles.fieldGap}
            />

            <Input
              label="Profile photo"
              optional
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="https://example.com/your-photo.jpg"
              autoCapitalize="none"
              keyboardType="url"
              hint="Paste a public image link (http or https)."
              containerStyle={styles.fieldGap}
            />

            {/* Life stage */}
            <View style={styles.fieldGap}>
              <AppText variant="label">Life stage</AppText>
              <View style={styles.chipRow}>
                {LIFE_STAGE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={lifeStage === option.value}
                    onPress={() =>
                      setLifeStage((prev) => (prev === option.value ? null : option.value))
                    }
                  />
                ))}
              </View>
            </View>

            {/* Languages */}
            <View style={styles.fieldGap}>
              <AppText variant="label">Languages</AppText>
              {languages.length > 0 ? (
                <View style={styles.chipRow}>
                  {languages.map((language) => (
                    <Chip
                      key={language}
                      label={language}
                      onRemove={() =>
                        setLanguages((prev) => prev.filter((l) => l !== language))
                      }
                    />
                  ))}
                </View>
              ) : (
                <AppText variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                  None added yet.
                </AppText>
              )}
              <View style={styles.langAddRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={languageDraft}
                    onChangeText={setLanguageDraft}
                    placeholder="Add a language"
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={addLanguages}
                    containerStyle={{ flex: 1 }}
                  />
                </View>
                <Button
                  label="Add"
                  variant="outline"
                  size="sm"
                  onPress={addLanguages}
                  disabled={!languageDraft.trim()}
                />
              </View>
            </View>

            {/* Visibility */}
            <View style={styles.fieldGap}>
              <AppText variant="label">Profile visibility</AppText>
              <View style={styles.chipRow}>
                {VISIBILITY_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={visibility === option.value}
                    onPress={() => setVisibility(option.value as Visibility)}
                  />
                ))}
              </View>
              <AppText variant="caption" color="textMuted" style={{ marginTop: 6 }}>
                {VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.hint}
              </AppText>
            </View>

            {/* Location */}
            <View style={styles.fieldGap}>
              <AppText variant="label">Current location</AppText>
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
                  <AppText variant="body" numberOfLines={1}>
                    {country ? country.name : 'Not set'}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>

              <Pressable
                onPress={country ? openCityPicker : undefined}
                disabled={!country}
                accessibilityRole="button"
                accessibilityLabel="Select city"
                style={({ pressed }) => [
                  styles.selectRow,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    opacity: !country ? 0.5 : pressed ? 0.7 : 1,
                    marginTop: 8,
                  },
                ]}
              >
                <Ionicons name="location-outline" size={18} color={theme.colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color="textMuted">
                    City
                  </AppText>
                  <AppText variant="body" numberOfLines={1}>
                    {city ? city.name : country ? 'Not set' : 'Pick a country first'}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {formError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.colors.dangerTint }]}>
                <AppText variant="caption" color="danger">
                  {formError}
                </AppText>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="outline" onPress={onClose} disabled={saving} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={saving ? 'Saving…' : 'Save changes'}
                onPress={onSave}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Country / city picker - rendered above the sheet while open. */}
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
              <Button
                label="Try again"
                variant="outline"
                size="sm"
                onPress={() => {
                  if (picker === 'country') {
                    setCountries([]);
                    openCountryPicker();
                  } else {
                    openCityPicker();
                  }
                }}
                style={{ marginTop: 10 }}
              />
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
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => (picker === 'country' ? pickCountry(item) : pickCity(item))}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={({ pressed }) => [
                    styles.pickerItem,
                    {
                      backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium">{item.label}</AppText>
                    {item.hint ? (
                      <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                        {item.hint}
                      </AppText>
                    ) : null}
                  </View>
                  {(picker === 'country' ? country?.id : city?.id) === item.id ? (
                    <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  )}
                </Pressable>
              )}
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
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  sheetScroll: {
    paddingHorizontal: 16,
  },
  sheetScrollContent: {
    paddingBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGap: {
    marginTop: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontWeight: '600',
  },
  chipRemove: {
    marginLeft: 6,
  },
  langAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorBox: {
    marginTop: 16,
    padding: 10,
    borderRadius: 10,
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
});

export default ProfileEditSheet;
