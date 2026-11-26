/**
 * ============================================================================
 * Post form (Prompt.md §12)
 * ============================================================================
 *
 * One screen renders every posting type from `lib/post-types.ts`:
 *
 *   step 1..n   the type's fields, split into logical groups
 *   last step   a preview of exactly what will be saved
 *
 * Required and optional fields are labelled explicitly, validation runs
 * before advancing, and saving persists a real draft on the device.
 *
 * Parcel types additionally show a safety notice and are filtered so money,
 * payment or guarantee fields can never be rendered for them (Prompt.md §16).
 */

import { Ionicons } from '@expo/vector-icons';
import { goBackSafe } from '@/lib/nav';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { draftsRepo, Draft, DraftValues, draftTitle } from '@/lib/drafts';
import { ApiError, api } from '@/lib/api';
import { assertFieldsAllowed, postTypeById, PostField, PostTypeDef } from '@/lib/post-types';
import { useTheme } from '@/theme/use-theme';

type Params = { type?: string; draftId?: string; listingId?: string };

/** Published listing reference for the success screen. */
interface PublishedListing {
  id: string;
  title: string;
  /** False when the action updated an existing listing instead. */
  created: boolean;
}

/** Owner-view row from GET /rooms/mine, used to prefill the editor. */
interface OwnedListing {
  id: string;
  title?: string;
  description?: string | null;
  accommodationType?: string;
  furnished?: string | null;
  rent?: number;
  currency?: string;
  city?: string | null;
  area?: string | null;
  availableFrom?: string | null;
  billsIncluded?: boolean | null;
  houseRules?: string | null;
}

/** Maps a stored listing back onto the wizard's field keys. */
function valuesFromListing(r: OwnedListing): DraftValues {
  const location = [r.city, r.area].filter(Boolean).join(', ');
  return {
    title: r.title ?? '',
    location,
    accommodationType: r.accommodationType ?? 'room_shared',
    rent: r.rent ? String(r.rent) : '',
    currency: r.currency ?? 'GBP',
    ...(r.furnished ? { furnished: r.furnished } : {}),
    ...(r.availableFrom ? { availableFrom: r.availableFrom } : {}),
    ...(r.billsIncluded === null || r.billsIncluded === undefined
      ? {}
      : { billsIncluded: r.billsIncluded ? 'yes' : 'no' }),
    description: r.description ?? '',
    ...(r.houseRules ? { houseRules: r.houseRules } : {}),
  };
}

/**
 * Maps the wizard's values onto POST /rooms. The city/neighbourhood field is
 * split server-side-resolved: `cityName` is matched against the geography
 * table and everything after the first comma is stored as the neighbourhood
 * (never an exact address - Prompt.md 3).
 */
function buildRoomPayload(values: DraftValues) {
  const text = (key: string): string =>
    typeof values[key] === 'string' ? values[key].trim() : '';

  const [cityPart, ...areaParts] = text('location').split(',');
  const cityName = (cityPart ?? '').trim();
  const area = areaParts.join(',').trim();

  const rent = Math.round(Number(text('rent').replace(/[^0-9.]/g, '')) || 0);
  const availableFrom = text('availableFrom');
  const bills = typeof values.billsIncluded === 'string' ? values.billsIncluded : '';

  return {
    title: text('title'),
    description: text('description'),
    accommodationType: text('accommodationType') || 'room_shared',
    ...(text('furnished') ? { furnished: text('furnished') } : {}),
    rent,
    currency: text('currency') || 'GBP',
    ...(cityName ? { cityName } : {}),
    ...(area ? { area } : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(availableFrom) ? { availableFrom } : {}),
    ...(bills ? { billsIncluded: bills === 'yes' } : {}),
    ...(text('houseRules') ? { houseRules: text('houseRules') } : {}),
    // No status here on purpose: a create defaults to ACTIVE server-side,
    // while an edit must never silently re-activate a paused listing.
  };
}

export default function PostFormScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<Params>();

  const type = postTypeById(typeof params.type === 'string' ? params.type : undefined);
  const draftId = typeof params.draftId === 'string' ? params.draftId : undefined;
  const listingId = typeof params.listingId === 'string' ? params.listingId : undefined;
  // Only the rooms marketplace has a backend; the other six post types stay
  // device drafts until their endpoints ship (honest copy, no fake success).
  const canPublish = type?.id === 'list-property';

  const [values, setValues] = useState<DraftValues>({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftId) || Boolean(listingId));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [published, setPublished] = useState<PublishedListing | null>(null);

  const fields = useMemo(
    () => (type ? assertFieldsAllowed(type) : []),
    [type],
  );

  const fieldSteps = useMemo<PostField[][]>(() => {
    if (fields.length <= 5) return [fields];
    const mid = Math.ceil(fields.length / 2);
    return [fields.slice(0, mid), fields.slice(mid)];
  }, [fields]);

  const totalSteps = fieldSteps.length + 1;
  const isPreview = step >= fieldSteps.length;

  // Prefill when editing an existing draft.
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    draftsRepo
      .get(draftId)
      .then((draft) => {
        if (cancelled) return;
        if (draft) {
          setValues(draft.values);
          setStep(0);
        }
        setLoadingDraft(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingDraft(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  // Prefill when editing one of the member's own listings (My listings).
  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    api
      .get<OwnedListing[]>('/rooms/mine')
      .then((rows) => {
        if (cancelled) return;
        const row = (rows ?? []).find((r) => r.id === listingId);
        if (row) {
          setValues(valuesFromListing(row));
          setStep(0);
        }
        setLoadingDraft(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingDraft(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (!type) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <FormHeader title="Create" onBack={() => goBackSafe()} stepLabel={null} />
        <ErrorState
          title="That posting type is not available"
          message="It may have been renamed or removed. Choose an option from the Post sheet instead."
          onRetry={() => router.replace('/post')}
          retryLabel="Back to Post"
          secondaryAction={{ label: 'Go back', onPress: () => goBackSafe() }}
        />
      </SafeAreaView>
    );
  }

  if (loadingDraft) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <FormHeader title={type.shortLabel} onBack={() => goBackSafe()} stepLabel={null} />
        <LoadingState
          label={listingId ? 'Opening your listing…' : 'Opening your draft…'}
        />
      </SafeAreaView>
    );
  }

  /* ---------------------------------------------------------------- success */

  if (published) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <FormHeader title={type.shortLabel} onBack={() => goBackSafe()} stepLabel={null} />
        <View style={styles.successWrap}>
          <View
            style={[
              styles.successIcon,
              {
                backgroundColor: theme.colors.successTint,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <Ionicons name="checkmark" size={34} color={theme.colors.success} />
          </View>

          <AppText variant="heading" align="center" style={{ marginTop: theme.spacing.lg }}>
            {published.created ? 'Listing published' : 'Changes saved'}
          </AppText>

          <AppText
            variant="body"
            color="textSecondary"
            align="center"
            style={{ marginTop: theme.spacing.sm, maxWidth: 340 }}
          >
            {published.created
              ? `“${published.title}” is live. It shows up in Home, Explore and the rooms feed, and people can message you about it directly.`
              : `“${published.title}” has been updated. Everyone viewing the listing sees the new details right away.`}
          </AppText>

          <View style={{ marginTop: theme.spacing.xl, width: '100%', maxWidth: 320 }}>
            <Button
              label="View listing"
              fullWidth
              onPress={() => router.replace(`/room-detail?id=${published.id}`)}
              testID="post-form-view-listing"
            />
            <View style={{ marginTop: theme.spacing.sm }}>
              <Button
                label="Done"
                variant="outline"
                fullWidth
                onPress={() => goBackSafe()}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (saved) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <FormHeader title={type.shortLabel} onBack={() => goBackSafe()} stepLabel={null} />
        <View style={styles.successWrap}>
          <View
            style={[
              styles.successIcon,
              {
                backgroundColor: theme.colors.successTint,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <Ionicons name="checkmark" size={34} color={theme.colors.success} />
          </View>

          <AppText variant="heading" align="center" style={{ marginTop: theme.spacing.lg }}>
            Draft saved
          </AppText>

          <AppText
            variant="body"
            color="textSecondary"
            align="center"
            style={{ marginTop: theme.spacing.sm, maxWidth: 340 }}
          >
            “{saved.title}” is saved on this device. You can edit or delete it from My drafts at any
            time.
          </AppText>

          <AppText
            variant="caption"
            color="textMuted"
            align="center"
            style={{ marginTop: theme.spacing.md, maxWidth: 340 }}
          >
            Publishing to the marketplace opens as each category launches.
          </AppText>

          <View style={{ marginTop: theme.spacing.xl, width: '100%', maxWidth: 320 }}>
            <Button
              label="Done"
              fullWidth
              onPress={() => goBackSafe()}
              testID="post-form-done"
            />
            <View style={{ marginTop: theme.spacing.sm }}>
              <Button
                label="Create another"
                variant="outline"
                fullWidth
                onPress={() => {
                  setValues({});
                  setStep(0);
                  setErrors({});
                  setSaved(null);
                }}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ----------------------------------------------------------------- steps */

  const stepFields = isPreview ? [] : fieldSteps[step];
  const stepLabel = isPreview
    ? `Step ${totalSteps} of ${totalSteps} · Preview`
    : `Step ${step + 1} of ${totalSteps} · ${step === 0 ? 'Basics' : 'Details'}`;

  function validateCurrentStep(): boolean {
    if (isPreview) return true;
    const next: Record<string, string> = {};

    for (const field of fieldSteps[step]) {
      const raw = values[field.key];
      const empty =
        typeof raw === 'string' ? raw.trim().length === 0 : raw === undefined || raw === false;

      if (field.required && empty) {
        next[field.key] = `${field.label} is required`;
        continue;
      }

      if (!empty && field.type === 'number' && typeof raw === 'string') {
        if (!/^\d+(\.\d+)?$/.test(raw.trim())) {
          next[field.key] = 'Enter a number';
        }
      }

      if (!empty && field.type === 'date' && typeof raw === 'string') {
        // No date picker in this form, so the accepted format is stated and
        // enforced instead of letting "next tuesday" through to the API.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
          next[field.key] = 'Use the format YYYY-MM-DD';
        }
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function saveDraft() {
    if (saving) return;
    setSaving(true);
    try {
      if (!type) throw new Error('Post type not available');
      const title = draftTitle(type.titleField, values);
      const draft = await draftsRepo.save({
        id: draftId,
        type: type.id,
        title,
        values,
      });
      setSaved(draft);
    } catch {
      setErrors({ _form: 'We could not save the draft. Check your device storage and try again.' });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Publishes to the live marketplace (POST /rooms) or, when the form was
   * opened from My listings, updates that row (PATCH /rooms/:id). The server
   * decides nothing about status here: a create defaults to ACTIVE and an
   * edit leaves the current status untouched, so editing a paused listing
   * cannot silently put it back in the feed. A draft the flow started from is
   * removed after publishing so the two can never drift apart.
   */
  async function publishListing() {
    if (saving) return;
    setSaving(true);
    setErrors({});
    try {
      if (!type) throw new Error('Post type not available');
      const payload = buildRoomPayload(values);
      const room = listingId
        ? await api.patch<{ id: string; title?: string }>(
            `/rooms/${listingId}`,
            payload,
          )
        : await api.post<{ id: string; title?: string }>('/rooms', payload);
      if (draftId) {
        await draftsRepo.remove(draftId).catch(() => {});
      }
      setPublished({
        id: room.id ?? listingId,
        title: room.title || draftTitle(type.titleField, values),
        created: !listingId,
      });
    } catch (err) {
      setErrors({
        _form:
          err instanceof ApiError
            ? err.message
            : listingId
              ? 'Could not save your changes. Please try again.'
              : 'Could not publish your listing. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <FormHeader
        title={listingId ? 'Edit listing' : type.label}
        onBack={() => goBackSafe()}
        stepLabel={stepLabel}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: theme.spacing.huge }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: theme.layout.screenPadding }}>
            {/* Progress */}
            <View style={styles.progressTrack}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSeg,
                    {
                      backgroundColor:
                        i <= step ? theme.colors.primary : theme.colors.surfaceSunken,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                />
              ))}
            </View>

            {isPreview ? (
              <PreviewStep
                type={type}
                fields={fields}
                values={values}
                canPublish={canPublish}
                isEdit={Boolean(listingId)}
              />
            ) : (
              <>
                {step === 0 ? (
                  <Card padding="lg" style={{ marginTop: theme.spacing.lg }}>
                    <AppText variant="body" color="textSecondary">
                      {type.intro}
                    </AppText>
                    {type.safetyNotice ? (
                      <View
                        style={[
                          styles.notice,
                          {
                            backgroundColor: theme.colors.warningTint,
                            borderRadius: theme.radius.md,
                          },
                        ]}
                      >
                        <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.warning} />
                        <AppText
                          variant="caption"
                          color="text"
                          style={{ flex: 1, marginLeft: 8 }}
                        >
                          {type.safetyNotice}
                        </AppText>
                      </View>
                    ) : null}
                  </Card>
                ) : null}

                <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.lg }}>
                  {stepFields.map((field) => (
                    <FieldControl
                      key={field.key}
                      field={field}
                      value={values[field.key]}
                      error={errors[field.key]}
                      onChange={(value) => {
                        setValues((prev) => ({ ...prev, [field.key]: value }));
                        setErrors((prev) => {
                          if (!prev[field.key]) return prev;
                          const next = { ...prev };
                          delete next[field.key];
                          return next;
                        });
                      }}
                    />
                  ))}
                </View>
              </>
            )}

            {errors._form ? (
              <AppText variant="caption" color="danger" style={{ marginTop: theme.spacing.md }}>
                {errors._form}
              </AppText>
            ) : null}
          </View>
        </ScrollView>

        {/* Actions */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
              paddingBottom: theme.spacing.lg,
            },
          ]}
        >
          {isPreview && canPublish && !listingId ? (
            <View style={{ marginBottom: 8 }}>
              <Button
                label={draftId ? 'Update draft' : 'Save draft instead'}
                variant="ghost"
                fullWidth
                onPress={saveDraft}
                loading={saving}
                testID="post-form-save"
              />
            </View>
          ) : null}

          <View style={styles.footerRow}>
            {step > 0 ? (
              <Button label="Back" variant="outline" onPress={goBack} style={styles.footerBtn} />
            ) : (
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => goBackSafe()}
                style={styles.footerBtn}
              />
            )}

            {isPreview ? (
              canPublish ? (
                <Button
                  label={listingId ? 'Save changes' : 'Publish listing'}
                  onPress={publishListing}
                  loading={saving}
                  style={styles.footerBtn}
                  testID="post-form-publish"
                />
              ) : (
                <Button
                  label={draftId ? 'Update draft' : 'Save draft'}
                  onPress={saveDraft}
                  loading={saving}
                  style={styles.footerBtn}
                  testID="post-form-save"
                />
              )
            ) : (
              <Button label="Continue" onPress={goNext} style={styles.footerBtn} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* --------------------------------------------------------------------------- *
 * Header
 * ------------------------------------------------------------------------ */

function FormHeader({
  title,
  stepLabel,
  onBack,
}: {
  title: string;
  stepLabel: string | null;
  onBack: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={theme.layout.hitSlop}
        style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </Pressable>

      <View style={styles.headerText}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {title}
        </AppText>
        {stepLabel ? (
          <AppText variant="caption" color="textMuted" style={{ marginTop: 1 }}>
            {stepLabel}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/* --------------------------------------------------------------------------- *
 * Field control
 * ------------------------------------------------------------------------ */

function FieldControl({
  field,
  value,
  error,
  onChange,
}: {
  field: PostField;
  value: string | boolean | undefined;
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  const theme = useTheme();
  const textValue = typeof value === 'string' ? value : '';

  if (field.type === 'switch') {
    return (
      <View>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <AppText variant="label">{field.label}</AppText>
            {field.hint ? (
              <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                {field.hint}
              </AppText>
            ) : null}
          </View>
          <Switch
            value={value === true}
            onValueChange={onChange}
            trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
            thumbColor={theme.colors.surface}
            accessibilityLabel={field.label}
          />
        </View>
      </View>
    );
  }

  if (field.type === 'select') {
    return (
      <View>
        <View style={styles.labelRow}>
          <AppText variant="label">{field.label}</AppText>
          {field.required ? (
            <AppText variant="caption" color="danger" style={{ marginLeft: 4 }}>
              *
            </AppText>
          ) : (
            <AppText variant="caption" color="textMuted" style={{ marginLeft: 6 }}>
              Optional
            </AppText>
          )}
        </View>

        <View style={styles.chips}>
          {(field.options ?? []).map((option) => {
            const active = textValue === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
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
                <AppText
                  variant="caption"
                  style={{
                    color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary,
                    fontWeight: active ? '700' : '500',
                  }}
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <AppText variant="caption" color="danger" style={{ marginTop: 6 }} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}
      </View>
    );
  }

  const multiline = field.type === 'textarea';

  return (
    <Input
      label={field.label}
      required={field.required}
      optional={!field.required}
      hint={field.hint}
      error={error}
      value={textValue}
      onChangeText={onChange}
      placeholder={field.placeholder}
      multiline={multiline}
      maxLength={field.maxLength}
      keyboardType={field.numeric ? 'number-pad' : field.type === 'number' ? 'decimal-pad' : 'default'}
      autoCapitalize={
        multiline ? 'sentences' : field.type === 'text' ? 'words' : 'none'
      }
      returnKeyType={multiline ? 'default' : 'next'}
    />
  );
}

/* --------------------------------------------------------------------------- *
 * Preview
 * ------------------------------------------------------------------------ */

function PreviewStep({
  type,
  fields,
  values,
  canPublish,
  isEdit,
}: {
  type: PostTypeDef;
  fields: PostField[];
  values: DraftValues;
  canPublish: boolean;
  isEdit?: boolean;
}) {
  const theme = useTheme();

  const rows = fields.filter((field) => {
    const raw = values[field.key];
    if (typeof raw === 'boolean') return raw === true;
    return typeof raw === 'string' && raw.trim().length > 0;
  });

  return (
    <View style={{ marginTop: theme.spacing.lg }}>
      <View style={styles.previewHeading}>
        <Badge label="Preview" tone="primary" icon="◐" />
        <AppText variant="caption" color="textMuted" style={{ marginLeft: 8 }}>
          {canPublish
            ? isEdit
              ? 'These changes go live immediately'
              : 'This is exactly what will go live'
            : 'This is exactly what will be saved'}
        </AppText>
      </View>

      <Card padding="lg" elevated style={{ marginTop: theme.spacing.md }}>
        <AppText variant="subheading">{draftTitle(type.titleField, values)}</AppText>
        <View style={{ marginTop: 6 }}>
          <Badge label={type.shortLabel} tone={type.tint === 'accent' ? 'accent' : 'neutral'} />
        </View>

        <View style={[styles.previewDivider, { backgroundColor: theme.colors.border }]} />

        {rows.length === 0 ? (
          <AppText variant="body" color="textMuted">
            Nothing has been filled in yet.
          </AppText>
        ) : (
          rows.map((field) => (
            <View key={field.key} style={styles.previewRow}>
              <AppText variant="caption" color="textMuted" style={styles.previewLabel}>
                {field.label}
              </AppText>
              <AppText variant="body" style={styles.previewValue}>
                {typeof values[field.key] === 'boolean' ? 'Yes' : String(values[field.key])}
              </AppText>
            </View>
          ))
        )}
      </Card>

      {type.safetyNotice ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: theme.colors.warningTint, marginTop: theme.spacing.lg },
          ]}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.warning} />
          <AppText variant="caption" color="text" style={{ flex: 1, marginLeft: 8 }}>
            {type.safetyNotice}
          </AppText>
        </View>
      ) : null}

      <AppText variant="caption" color="textMuted" style={{ marginTop: theme.spacing.lg }}>
        {canPublish
          ? isEdit
            ? 'Saving updates your public listing right away - anyone viewing it sees the new details.'
            : 'Publishing makes this listing public in Home, Explore and the rooms feed. Anyone can then message you about it.'
          : 'Saved drafts stay on this device until you delete them.'}
      </AppText>
    </View>
  );
}

/* --------------------------------------------------------------------------- *
 * Styles
 * ------------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  progressSeg: {
    flex: 1,
    height: 4,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginTop: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchText: {
    flex: 1,
    paddingRight: 16,
  },
  previewHeading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  previewRow: {
    marginBottom: 12,
  },
  previewLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewValue: {
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footerBtn: {
    flex: 1,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
