/**=============================================================================
 * My listings (host surface for the publish flow).
 *
 * Shows every listing the signed-in member owns in ANY status (GET
 * /rooms/mine), with the actions that make the write endpoints real:
 *   - Pause / Activate  -> PATCH /rooms/:id { status }
 *   - Edit              -> post-form prefilled from the listing
 *   - Delete            -> DELETE /rooms/:id, with an inline confirm
 *
 * Active listings link through to the public detail page; paused and draft
 * ones cannot be viewed publicly yet, so they only offer the owner actions.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/layout/back-header';
import { AppText } from '@/components/ui/app-text';
import { Badge, TrustRow } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SignInRequired } from '@/components/sign-in-required';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { router } from 'expo-router';
import { useTheme } from '@/theme/use-theme';

/** Mirrors the API's ListingStatus, including the two moderation states. */
type OwnedStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'ARCHIVED';

type OwnedListing = {
  id: string;
  title?: string;
  rent?: number;
  currency?: string;
  city?: string;
  area?: string | null;
  status?: OwnedStatus;
  /** The admin's rejection reason; null unless this listing was turned down. */
  reviewNote?: string | null;
  demoData?: boolean;
};

const STATUS_TONE = {
  ACTIVE: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  PAUSED: 'warning',
  DRAFT: 'neutral',
  ARCHIVED: 'neutral',
} as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Live',
  PENDING: 'In review',
  REJECTED: 'Rejected',
  PAUSED: 'Paused',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
};

export default function MyListingsScreen() {
  const theme = useTheme();
  const { status: authStatus } = useAuth();

  const [listings, setListings] = useState<OwnedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<OwnedListing[]>('/rooms/mine');
      setListings(res ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(null);
      } else {
        setError(
          err instanceof ApiError ? err.message : 'Could not load your listings.',
        );
      }
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Anonymous visitors never hit the endpoint; they get the sign-in state.
    if (authStatus === 'anonymous') return;
    // Defer the kick-off so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      void load();
    });
  }, [load, authStatus]);

  /**
   * Status changes are one PATCH on the owner's own row. The server owns the
   * rules - only an admin may grant ACTIVE to an unapproved listing - so a
   * refusal is surfaced instead of swallowed: silently doing nothing would
   * look exactly like a broken button.
   */
  const setListingStatus = async (listing: OwnedListing, next: OwnedStatus) => {
    if (busyId) return;
    setBusyId(listing.id);
    setStatusError(null);
    try {
      const updated = await api.patch<OwnedListing>(`/rooms/${listing.id}`, {
        status: next,
      });
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, ...updated } : l)),
      );
    } catch (err) {
      setStatusError(
        err instanceof ApiError ? err.message : 'Could not update this listing.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const removeListing = async (listing: OwnedListing) => {
    if (busyId) return;
    setBusyId(listing.id);
    try {
      await api.delete(`/rooms/${listing.id}`);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setConfirmDeleteId(null);
    } catch {
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  if (authStatus === 'anonymous') {
    return (
      <SignInRequired
        heading="My listings"
        title="Sign in to manage your listings"
        message="Everything you have published lives behind your account."
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingState label="Loading your listings…" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorState
          title="Could not load your listings"
          message={error}
          onRetry={() => void load()}
          secondaryAction={{ label: 'Go back', onPress: () => router.replace('/host-dashboard') }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <BackHeader
        title="My listings"
        subtitle="Pause, edit or remove what you have published"
        fallback="/host-dashboard"
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Refusals from the server (e.g. an unapproved listing cannot go
            live) are shown rather than swallowed. */}
        {statusError ? (
          <View style={{ marginBottom: 12 }}>
            <AppText variant="caption" color="danger">
              {statusError}
            </AppText>
          </View>
        ) : null}

        {listings.length === 0 ? (
          <EmptyState
            icon="⌂"
            title="You have not published anything yet"
            message="Publish a room from the Post sheet and it will appear here with its live status."
            action={{
              label: 'Create listing',
              onPress: () => router.push('/post-form?type=list-property'),
            }}
            secondaryAction={{ label: 'Go back', onPress: () => router.replace('/host-dashboard') }}
          />
        ) : (
          listings.map((listing) => {
            const isActive = listing.status === 'ACTIVE';
            const locationLine = [listing.area, listing.city].filter(Boolean).join(', ');
            const confirming = confirmDeleteId === listing.id;
            // What the owner may do next. ACTIVE and PAUSED toggle freely -
            // both were approved by an admin; anything not yet approved can
            // only go back into the review queue, never straight to live.
            // PENDING deliberately has no action: it is already submitted.
            const primaryAction =
              listing.status === 'ACTIVE'
                ? { label: 'Pause', next: 'PAUSED' as const }
                : listing.status === 'PAUSED'
                  ? { label: 'Activate', next: 'ACTIVE' as const }
                  : listing.status === 'REJECTED'
                    ? { label: 'Resubmit', next: 'PENDING' as const }
                    : listing.status === 'DRAFT'
                      ? { label: 'Submit for review', next: 'PENDING' as const }
                      : null;

            return (
              <Card key={listing.id} padding="md" style={{ marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <AppText variant="bodyMedium" style={{ flex: 1, minWidth: 160 }} numberOfLines={2}>
                    {listing.title ?? 'Untitled listing'}
                  </AppText>
                  <Badge
                    label={STATUS_LABEL[listing.status ?? 'DRAFT'] ?? 'Draft'}
                    tone={STATUS_TONE[listing.status ?? 'DRAFT'] ?? 'neutral'}
                  />
                </View>

                <TrustRow isDemo={listing.demoData ?? false} size="sm" style={{ marginTop: 6 }} />

                <AppText variant="caption" color="textMuted" style={{ marginTop: 6 }}>
                  {[
                    locationLine,
                    listing.rent && listing.rent > 0
                      ? `${listing.rent.toLocaleString()} ${listing.currency ?? 'GBP'} / month`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No details yet'}
                </AppText>

                {listing.status === 'PENDING' ? (
                  <AppText variant="caption" color="textMuted" style={{ marginTop: 8 }}>
                    Submitted for review - it goes live once an admin approves it.
                  </AppText>
                ) : null}

                {listing.status === 'REJECTED' ? (
                  <View style={{ marginTop: 8 }}>
                    <AppText variant="caption" color="danger">
                      {listing.reviewNote
                        ? `Rejected: ${listing.reviewNote}`
                        : 'Rejected by an admin.'}
                    </AppText>
                    <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                      Fix the issue, then resubmit for review.
                    </AppText>
                  </View>
                ) : null}

                {confirming ? (
                  <View style={{ marginTop: 12 }}>
                    <AppText variant="caption" color="danger">
                      Delete “{listing.title ?? 'this listing'}” permanently? Existing messages
                      about it stay in people&apos;s inboxes.
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Keep it"
                          variant="outline"
                          size="sm"
                          disabled={busyId === listing.id}
                          onPress={() => setConfirmDeleteId(null)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label={busyId === listing.id ? 'Deleting…' : 'Delete'}
                          variant="danger"
                          size="sm"
                          loading={busyId === listing.id}
                          onPress={() => void removeListing(listing)}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    {isActive ? (
                      <Button
                        label="View"
                        variant="outline"
                        size="sm"
                        onPress={() => router.push(`/room-detail?id=${listing.id}`)}
                      />
                    ) : null}
                    {primaryAction ? (
                      <Button
                        label={primaryAction.label}
                        variant="outline"
                        size="sm"
                        loading={busyId === listing.id}
                        onPress={() => void setListingStatus(listing, primaryAction.next)}
                      />
                    ) : null}
                    <Button
                      label="Edit"
                      variant="outline"
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: '/post-form',
                          params: { type: 'list-property', listingId: listing.id },
                        })
                      }
                    />
                    <Button
                      label="Delete"
                      variant="ghost"
                      size="sm"
                      onPress={() => setConfirmDeleteId(listing.id)}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}

        <Pressable
          onPress={() => router.push('/post-form?type=list-property')}
          accessibilityRole="button"
          accessibilityLabel="Create another listing"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 14,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.borderStrong,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="add" size={18} color={theme.colors.primary} />
          <AppText variant="bodyMedium" color="primary">
            Create another listing
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
