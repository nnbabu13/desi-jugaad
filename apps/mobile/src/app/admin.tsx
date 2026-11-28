/**=============================================================================
 * Admin dashboard
 *
 * Statistics plus the switches the operator asked for: review queue,
 * listings, members, locations and platform settings.
 *
 * Access: the API is the authority - every route behind it demands ADMIN, so
 * this screen merely avoids showing controls the server would refuse. It
 * still handles 401 (offer sign-in) and 403 (offer a way out) explicitly,
 * because a stale session or a demoted account must not leave a dead screen.
 *
 * Reached from Profile, which only shows the row to admins.
 *=============================================================================*/

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/layout/back-header';
import { SignInRequired } from '@/components/sign-in-required';
import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, SkeletonCard } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/use-theme';

type TabKey =
  | 'overview'
  | 'moderation'
  | 'listings'
  | 'users'
  | 'locations'
  | 'settings';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'moderation', label: 'Moderation' },
  { key: 'listings', label: 'Listings' },
  { key: 'users', label: 'Users' },
  { key: 'locations', label: 'Locations' },
  { key: 'settings', label: 'Settings' },
];

/** Category ids the client renders; mirrors the API's CATEGORY_IDS. */
const CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: 'rentals', label: 'Rooms & Rentals' },
  { id: 'services', label: 'Local Services' },
  { id: 'parcel', label: 'Parcel Assistance' },
  { id: 'community', label: 'Community' },
];

interface PlatformSettings {
  disabledCategories: string[];
  maintenanceMode: boolean;
  registrationOpen: boolean;
}

interface AdminStats {
  users: {
    total: number;
    active: number;
    pendingVerification: number;
    suspended: number;
    newThisWeek: number;
  };
  listings: {
    total: number;
    active: number;
    awaitingReview: number;
    rejected: number;
    paused: number;
    draft: number;
  };
  listingsByCity: { city: string; country: string | null; count: number }[];
  geography: {
    countries: { total: number; active: number };
    cities: { total: number; active: number };
  };
  engagement: { conversations: number; messages: number };
  settings: PlatformSettings;
  generatedAt: string;
}

/** One row of the review queue or the roster - the fields the UI shows. */
interface ReviewListing {
  id: string;
  title?: string;
  description?: string | null;
  rent?: number;
  currency?: string;
  area?: string | null;
  status: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  city?: { name: string; country?: { name: string; isoCode: string } } | null;
  host?: {
    id?: string;
    email?: string;
    profile?: { fullName?: string | null } | null;
  } | null;
}

interface AdminUser {
  id: string;
  email: string;
  status: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string | null;
  profile?: { fullName?: string | null; avatarUrl?: string | null } | null;
  _count?: { rooms: number };
}

interface CountryRow {
  id: string;
  isoCode: string;
  name: string;
  flagEmoji?: string | null;
  isActive: boolean;
  isFeatured?: boolean;
  _count?: { cities: number };
}

interface CityRow {
  id: string;
  name: string;
  region?: string | null;
  isActive: boolean;
  isLaunch?: boolean;
  _count?: { rooms: number };
  country: { id: string; isoCode: string; name: string };
}

interface LocationsResponse {
  countries: CountryRow[];
  cities: CityRow[];
  counts: {
    countries: { total: number; active: number };
    cities: { total: number; active: number };
  };
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  PAUSED: 'neutral',
  DRAFT: 'neutral',
  ARCHIVED: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Live',
  PENDING: 'In review',
  REJECTED: 'Rejected',
  PAUSED: 'Paused',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
};

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return <Badge label={STATUS_LABEL[status] ?? status} tone={tone} size="sm" />;
}

/** One number with its caption; the dashboard's basic unit. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'success' | 'warning' | 'danger';
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <AppText
        variant="heading"
        style={{ color: tone ? theme.colors[tone] : theme.colors.text }}
      >
        {value}
      </AppText>
      <AppText
        variant="caption"
        color="textMuted"
        style={{ marginTop: 2, textAlign: 'center' }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** A switchable setting row: label, hint, and the server-backed toggle. */
function ToggleRow({
  label,
  hint,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <AppText variant="bodyMedium">{label}</AppText>
        <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
          {hint}
        </AppText>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function AdminScreen() {
  const theme = useTheme();
  const { user, status: authStatus } = useAuth();

  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<ReviewListing[]>([]);
  const [rejected, setRejected] = useState<ReviewListing[]>([]);
  const [listings, setListings] = useState<ReviewListing[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [locations, setLocations] = useState<LocationsResponse | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const [countryIso, setCountryIso] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (authStatus === 'anonymous') return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      if (tab === 'overview') {
        setStats(await api.get<AdminStats>('/admin/stats'));
      } else if (tab === 'moderation') {
        const data = await api.get<{
          pending: ReviewListing[];
          rejected: ReviewListing[];
        }>('/admin/moderation/queue');
        setPending(data.pending ?? []);
        setRejected(data.rejected ?? []);
      } else if (tab === 'listings') {
        const data = await api.get<{ items: ReviewListing[] }>('/admin/listings', {
          query: { take: 60 },
        });
        setListings(data.items ?? []);
      } else if (tab === 'users') {
        const data = await api.get<{ items: AdminUser[] }>('/admin/users', {
          query: { take: 60 },
        });
        setUsers(data.items ?? []);
      } else if (tab === 'locations') {
        const data = await api.get<LocationsResponse>('/admin/locations', {
          query: countryIso ? { country: countryIso } : undefined,
        });
        setLocations(data);
        // Default the city list to the first country on the first load only,
        // so choosing a country later is not fought by this effect.
        if (!countryIso && data.countries.length > 0) {
          setCountryIso(data.countries[0].isoCode);
        }
      } else {
        setSettings(await api.get<PlatformSettings>('/admin/settings'));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setUnauthorized(true);
        else if (err.status === 403) setForbidden(true);
        else setError(err.message);
      } else {
        setError('Could not load admin data.');
      }
    } finally {
      setLoading(false);
    }
  }, [tab, authStatus, countryIso]);

  useEffect(() => {
    // Deferred so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      void load();
    });
  }, [load]);

  /** Runs one admin mutation, then reloads the current tab's data. */
  const runAction = useCallback(
    async (id: string, action: () => Promise<unknown>) => {
      if (busyId) return;
      setBusyId(id);
      setError(null);
      try {
        await action();
        setRejectingId(null);
        setRejectReason('');
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'That action could not be completed.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [busyId, load],
  );

  /* ------------------------------------------------------------- states */

  if (authStatus === 'anonymous' || unauthorized) {
    return (
      <SignInRequired
        heading="Admin"
        title="Sign in to reach the admin dashboard"
        message="This area is limited to administrator accounts."
      />
    );
  }

  if (forbidden) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <BackHeader title="Admin" fallback="/(tabs)/profile" />
        <EmptyState
          icon="⛔"
          title="Admin access required"
          message="This area is limited to administrator accounts. If you think that is a mistake, ask another admin to check your role."
          action={{ label: 'Back to profile', onPress: () => router.replace('/(tabs)/profile') }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <BackHeader
        title="Admin"
        subtitle={isAdmin ? 'Review, statistics and switches' : 'Checking access…'}
        fallback="/(tabs)/profile"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
          keyboardShouldPersistTaps="handled"
        >
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  styles.tab,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
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
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={{ marginTop: 12 }}>
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
          </View>
        ) : null}

        {loading ? (
          <View style={{ marginTop: 16 }}>
            <SkeletonCard count={3} />
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            {tab === 'overview' ? <OverviewTab stats={stats} /> : null}
            {tab === 'moderation' ? (
              <ModerationTab
                pending={pending}
                rejected={rejected}
                rejectingId={rejectingId}
                reason={rejectReason}
                busyId={busyId}
                onReasonChange={setRejectReason}
                onStartReject={(id) => {
                  setRejectingId(id);
                  setRejectReason('');
                }}
                onCancelReject={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
                onApprove={(id) => runAction(id, () => api.patch(`/admin/moderation/${id}/approve`, {}))}
                onReject={(id) =>
                  runAction(id, () =>
                    api.patch(`/admin/moderation/${id}/reject`, { reason: rejectReason.trim() }),
                  )
                }
              />
            ) : null}
            {tab === 'listings' ? (
              <ListingsTab
                listings={listings}
                busyId={busyId}
                onStatus={(id, status) =>
                  runAction(id, () => api.patch(`/admin/listings/${id}`, { status }))
                }
              />
            ) : null}
            {tab === 'users' ? (
              <UsersTab
                users={users}
                selfId={user?.id}
                busyId={busyId}
                adminCount={(users.filter((u) => u.role === 'ADMIN' && u.status !== 'SUSPENDED')).length}
                onUpdate={(id, patch) => runAction(id, () => api.patch(`/admin/users/${id}`, patch))}
              />
            ) : null}
            {tab === 'locations' ? (
              <LocationsTab
                data={locations}
                selectedIso={countryIso}
                busyId={busyId}
                onSelectCountry={(iso) => setCountryIso(iso)}
                onToggleCountry={(id, isActive) =>
                  runAction(id, () => api.patch(`/admin/locations/countries/${id}`, { isActive }))
                }
                onToggleCity={(id, isActive) =>
                  runAction(id, () => api.patch(`/admin/locations/cities/${id}`, { isActive }))
                }
              />
            ) : null}
            {tab === 'settings' ? (
              <SettingsTab
                settings={settings}
                busyId={busyId}
                onSet={(key, value) => runAction(key, () => api.patch('/admin/settings', { key, value }))}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ tabs */

function OverviewTab({ stats }: { stats: AdminStats | null }) {
  const theme = useTheme();
  if (!stats) return null;

  return (
    <View>
      <Card padding="md">
        <AppText variant="subheading">Members</AppText>
        <View style={styles.statGrid}>
          <Stat label="Total" value={stats.users.total} />
          <Stat label="Active" value={stats.users.active} tone="success" />
          <Stat label="New this week" value={stats.users.newThisWeek} />
          <Stat label="Suspended" value={stats.users.suspended} tone={stats.users.suspended > 0 ? 'danger' : undefined} />
        </View>
        <AppText variant="caption" color="textMuted" style={{ marginTop: 8 }}>
          {stats.users.pendingVerification} awaiting email verification
        </AppText>
      </Card>

      <Card padding="md" style={{ marginTop: 12 }}>
        <View style={styles.sectionHead}>
          <AppText variant="subheading">Listings</AppText>
          <Badge
            label={`${stats.listings.awaitingReview} awaiting review`}
            tone={stats.listings.awaitingReview > 0 ? 'warning' : 'neutral'}
            size="sm"
          />
        </View>
        <View style={styles.statGrid}>
          <Stat label="Live" value={stats.listings.active} tone="success" />
          <Stat label="In review" value={stats.listings.awaitingReview} tone={stats.listings.awaitingReview > 0 ? 'warning' : undefined} />
          <Stat label="Rejected" value={stats.listings.rejected} tone={stats.listings.rejected > 0 ? 'danger' : undefined} />
          <Stat label="Paused" value={stats.listings.paused} />
        </View>
        {stats.listingsByCity.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <AppText variant="caption" color="textMuted" style={{ marginBottom: 6 }}>
              LIVE BY CITY
            </AppText>
            {stats.listingsByCity.map((row) => (
              <View
                key={`${row.country ?? ''}-${row.city}`}
                style={[styles.inlineRow, { borderBottomColor: theme.colors.border }]}
              >
                <AppText variant="bodyMedium" style={{ flex: 1 }}>
                  {row.city}
                  {row.country ? ` · ${row.country}` : ''}
                </AppText>
                <AppText variant="bodyMedium" color="primary">
                  {row.count}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card padding="md" style={{ marginTop: 12 }}>
        <AppText variant="subheading">Platform</AppText>
        <View style={styles.statGrid}>
          <Stat
            label="Cities on"
            value={`${stats.geography.cities.active}/${stats.geography.cities.total}`}
          />
          <Stat
            label="Countries on"
            value={`${stats.geography.countries.active}/${stats.geography.countries.total}`}
          />
          <Stat label="Conversations" value={stats.engagement.conversations} />
          <Stat label="Messages" value={stats.engagement.messages} />
        </View>
        <View style={{ marginTop: 12 }}>
          <AppText variant="caption" color="textMuted" style={{ marginBottom: 6 }}>
            SWITCHES
          </AppText>
          <AppText variant="caption" color="textMuted">
            {stats.settings.registrationOpen ? 'Sign-up open' : 'Sign-up closed'}
            {' · '}
            {stats.settings.maintenanceMode ? 'Maintenance ON' : 'Maintenance off'}
            {' · '}
            {stats.settings.disabledCategories.length > 0
              ? `${stats.settings.disabledCategories.length} categor${stats.settings.disabledCategories.length === 1 ? 'y' : 'ies'} hidden`
              : 'All categories visible'}
          </AppText>
        </View>
      </Card>
    </View>
  );
}

function ModerationTab({
  pending,
  rejected,
  rejectingId,
  reason,
  busyId,
  onReasonChange,
  onStartReject,
  onCancelReject,
  onApprove,
  onReject,
}: {
  pending: ReviewListing[];
  rejected: ReviewListing[];
  rejectingId: string | null;
  reason: string;
  busyId: string | null;
  onReasonChange: (value: string) => void;
  onStartReject: (id: string) => void;
  onCancelReject: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (pending.length === 0 && rejected.length === 0) {
    return (
      <EmptyState
        icon="✓"
        title="Review queue is clear"
        message="Nothing is waiting on you. New submissions appear here the moment a member posts one."
        action={{ label: 'Back to overview', onPress: () => router.replace('/(tabs)/profile') }}
      />
    );
  }

  return (
    <View>
      <AppText variant="subheading">
        Awaiting review ({pending.length})
      </AppText>

      {pending.length === 0 ? (
        <Card padding="md" style={{ marginTop: 8 }}>
          <AppText variant="caption" color="textMuted">
            Nothing waiting for a decision.
          </AppText>
        </Card>
      ) : (
        pending.map((item) => {
          const rejecting = rejectingId === item.id;
          return (
            <Card key={item.id} padding="md" style={{ marginTop: 8 }}>
              <View style={styles.sectionHead}>
                <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={2}>
                  {item.title ?? 'Untitled listing'}
                </AppText>
                <StatusBadge status={item.status} />
              </View>

              <AppText variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                {[
                  item.host?.profile?.fullName ?? item.host?.email ?? 'Unknown host',
                  item.city?.name,
                  item.rent && item.rent > 0
                    ? `${item.rent.toLocaleString()} ${item.currency ?? 'GBP'} / month`
                    : null,
                  new Date(item.createdAt).toLocaleDateString(),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>

              {item.description ? (
                <AppText variant="caption" color="textMuted" numberOfLines={3} style={{ marginTop: 6 }}>
                  {item.description}
                </AppText>
              ) : null}

              {rejecting ? (
                <View style={{ marginTop: 10 }}>
                  <Input
                    label="Reason"
                    required
                    value={reason}
                    onChangeText={onReasonChange}
                    placeholder="What must the owner fix?"
                  />
                  <View style={styles.actionRow}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Confirm rejection"
                        variant="outline"
                        size="sm"
                        fullWidth
                        loading={busyId === item.id}
                        disabled={reason.trim().length < 3}
                        onPress={() => onReject(item.id)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label="Cancel" variant="ghost" size="sm" fullWidth onPress={onCancelReject} />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Approve"
                      size="sm"
                      fullWidth
                      loading={busyId === item.id}
                      onPress={() => onApprove(item.id)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Reject"
                      variant="outline"
                      size="sm"
                      fullWidth
                      onPress={() => onStartReject(item.id)}
                    />
                  </View>
                </View>
              )}
            </Card>
          );
        })
      )}

      {rejected.length > 0 ? (
        <View style={{ marginTop: 20 }}>
          <AppText variant="subheading">Rejected ({rejected.length})</AppText>
          {rejected.map((item) => (
            <Card key={item.id} padding="md" style={{ marginTop: 8 }}>
              <View style={styles.sectionHead}>
                <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={2}>
                  {item.title ?? 'Untitled listing'}
                </AppText>
                <StatusBadge status={item.status} />
              </View>
              {item.reviewNote ? (
                <AppText variant="caption" color="danger" style={{ marginTop: 6 }}>
                  {item.reviewNote}
                </AppText>
              ) : null}
              <AppText variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                {[item.host?.email, item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : null]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </Card>
          ))}
        </View>
      ) : null}
      <View style={{ height: 8 }} />
      <AppText variant="caption" color="textMuted">
        Approving publishes immediately; rejecting keeps it hidden until the owner resubmits.
      </AppText>
    </View>
  );
}

function ListingsTab({
  listings,
  busyId,
  onStatus,
}: {
  listings: ReviewListing[];
  busyId: string | null;
  onStatus: (id: string, status: string) => void;
}) {
  if (listings.length === 0) {
    return <EmptyState icon="⌂" title="No listings" message="Nothing has been posted yet." />;
  }

  return (
    <View>
      <AppText variant="caption" color="textMuted" style={{ marginBottom: 8 }}>
        EVERY LISTING, ANY STATUS - {listings.length} SHOWN
      </AppText>

      {listings.map((item) => (
        <Card key={item.id} padding="md" style={{ marginBottom: 10 }}>
          <View style={styles.sectionHead}>
            <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={2}>
              {item.title ?? 'Untitled listing'}
            </AppText>
            <StatusBadge status={item.status} />
          </View>

          <AppText variant="caption" color="textMuted" style={{ marginTop: 4 }}>
            {[
              item.host?.email,
              item.city?.name,
              item.rent && item.rent > 0
                ? `${item.rent.toLocaleString()} ${item.currency ?? 'GBP'}/mo`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>

          <View style={styles.actionRow}>
            {item.status !== 'ACTIVE' ? (
              <View style={{ flex: 1 }}>
                <Button
                  label="Make live"
                  size="sm"
                  fullWidth
                  loading={busyId === item.id}
                  onPress={() => onStatus(item.id, 'ACTIVE')}
                />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Button
                  label="Pause"
                  variant="outline"
                  size="sm"
                  fullWidth
                  loading={busyId === item.id}
                  onPress={() => onStatus(item.id, 'PAUSED')}
                />
              </View>
            )}
            {item.status !== 'ARCHIVED' ? (
              <View style={{ flex: 1 }}>
                <Button
                  label="Archive"
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onPress={() => onStatus(item.id, 'ARCHIVED')}
                />
              </View>
            ) : null}
          </View>
        </Card>
      ))}
      <AppText variant="caption" color="textMuted" style={{ marginTop: 4 }}>
        Pausing hides a listing from every feed; archiving retires it from the roster.
      </AppText>
    </View>
  );
}

function UsersTab({
  users,
  selfId,
  busyId,
  adminCount,
  onUpdate,
}: {
  users: AdminUser[];
  selfId?: string;
  busyId: string | null;
  adminCount: number;
  onUpdate: (id: string, patch: Record<string, string>) => void;
}) {
  if (users.length === 0) {
    return <EmptyState icon="👤" title="No accounts" message="Nobody has registered yet." />;
  }

  return (
    <View>
      <AppText variant="caption" color="textMuted" style={{ marginBottom: 8 }}>
        {users.length} ACCOUNTS - ROLE AND STATUS CAN BE CHANGED HERE
      </AppText>

      {users.map((item) => {
        const isSelf = item.id === selfId;
        const isLastAdmin =
          item.role === 'ADMIN' && item.status !== 'SUSPENDED' && adminCount <= 1;
        // Mirrors the server's lockout rules so the UI does not offer a
        // button the API would refuse with a 400.
        const canDemote = item.role === 'ADMIN' && !isSelf && !isLastAdmin;
        const canPromote = item.role === 'USER' && !isSelf;
        const canSuspend = item.status !== 'SUSPENDED' && !isSelf && !isLastAdmin;
        const canRestore = item.status === 'SUSPENDED';

        return (
          <Card key={item.id} padding="md" style={{ marginBottom: 10 }}>
            <View style={styles.sectionHead}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium" numberOfLines={1}>
                  {item.profile?.fullName ?? item.email}
                </AppText>
                <AppText variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 2 }}>
                  {item.email}
                  {item._count ? ` · ${item._count.rooms} listing${item._count.rooms === 1 ? '' : 's'}` : ''}
                </AppText>
              </View>
              <Badge
                label={item.role === 'ADMIN' ? 'Admin' : 'Member'}
                tone={item.role === 'ADMIN' ? 'accent' : 'neutral'}
                size="sm"
              />
            </View>

            <View style={{ marginTop: 8 }}>
              <StatusBadge status={item.status === 'SUSPENDED' ? 'REJECTED' : 'ACTIVE'} />
            </View>

            <View style={styles.actionRow}>
              {canDemote ? (
                <View style={{ flex: 1 }}>
                  <Button label="Remove admin" variant="outline" size="sm" fullWidth
                    onPress={() => onUpdate(item.id, { role: 'USER' })} />
                </View>
              ) : null}
              {canPromote ? (
                <View style={{ flex: 1 }}>
                  <Button label="Make admin" variant="outline" size="sm" fullWidth
                    onPress={() => onUpdate(item.id, { role: 'ADMIN' })} />
                </View>
              ) : null}
              {canSuspend ? (
                <View style={{ flex: 1 }}>
                  <Button label="Suspend" variant="ghost" size="sm" fullWidth
                    onPress={() => onUpdate(item.id, { status: 'SUSPENDED' })} />
                </View>
              ) : null}
              {canRestore ? (
                <View style={{ flex: 1 }}>
                  <Button label="Restore" size="sm" fullWidth
                    onPress={() => onUpdate(item.id, { status: 'ACTIVE' })} />
                </View>
              ) : null}
              {isSelf ? (
                <View style={{ flex: 2 }}>
                  <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
                    This is you - changes here are refused
                  </AppText>
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}
      <View style={{ height: 4 }} />
      <AppText variant="caption" color="textMuted">
        Suspending signs a member out everywhere; the last admin can be neither
        demoted nor suspended.
      </AppText>
    </View>
  );
}

function LocationsTab({
  data,
  selectedIso,
  busyId,
  onSelectCountry,
  onToggleCountry,
  onToggleCity,
}: {
  data: LocationsResponse | null;
  selectedIso: string | null;
  busyId: string | null;
  onSelectCountry: (iso: string) => void;
  onToggleCountry: (id: string, isActive: boolean) => void;
  onToggleCity: (id: string, isActive: boolean) => void;
}) {
  const theme = useTheme();
  if (!data) return null;

  const selected =
    data.countries.find((c) => c.isoCode === selectedIso) ?? data.countries[0];

  return (
    <View>
      <Card padding="md">
        <View style={styles.sectionHead}>
          <AppText variant="subheading">Countries</AppText>
          <Badge
            label={`${data.counts.countries.active}/${data.counts.countries.total} on`}
            tone="neutral"
            size="sm"
          />
        </View>

        {data.countries.map((country) => (
          <ToggleRow
            key={country.id}
            label={`${country.flagEmoji ?? ''} ${country.name}`.trim()}
            hint={`${country.isoCode} · ${country._count?.cities ?? 0} cities`}
            value={country.isActive}
            disabled={busyId === country.id}
            onValueChange={(next) => onToggleCountry(country.id, next)}
          />
        ))}
      </Card>

      <Card padding="md" style={{ marginTop: 12 }}>
        <View style={styles.sectionHead}>
          <AppText variant="subheading" style={{ flex: 1 }}>
            Cities{selected ? ` in ${selected.name}` : ''}
          </AppText>
          <Badge
            label={`${data.counts.cities.active}/${data.counts.cities.total} on`}
            tone="neutral"
            size="sm"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={styles.chipRow}>
            {data.countries.map((country) => {
              const active = country.isoCode === selected?.isoCode;
              return (
                <Pressable
                  key={country.id}
                  onPress={() => onSelectCountry(country.isoCode)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={country.name}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.colors.primaryTint : theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: active ? theme.colors.primary : theme.colors.textSecondary,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {country.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {data.cities.map((city) => (
          <ToggleRow
            key={city.id}
            label={city.name}
            hint={`${city.country.isoCode}${city.region ? ` · ${city.region}` : ''}${
              city._count ? ` · ${city._count.rooms} listing${city._count.rooms === 1 ? '' : 's'}` : ''
            }`}
            value={city.isActive}
            disabled={busyId === city.id}
            onValueChange={(next) => onToggleCity(city.id, next)}
          />
        ))}
      </Card>

      <AppText variant="caption" color="textMuted" style={{ marginTop: 10 }}>
        Switching a country or city off removes it from every picker and takes
        its listings off the public feed; owners can still open their own.
      </AppText>
    </View>
  );
}

function SettingsTab({
  settings,
  busyId,
  onSet,
}: {
  settings: PlatformSettings | null;
  busyId: string | null;
  onSet: (key: string, value: unknown) => void;
}) {
  const theme = useTheme();
  if (!settings) return null;

  const enabled = new Set(settings.disabledCategories);
  const allHidden = enabled.size >= CATEGORY_OPTIONS.length;

  const toggleCategory = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) {
      // Turning off the last visible category would leave the app with no
      // content at all, which the API refuses too.
      if (allHidden) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onSet('disabledCategories', [...next]);
  };

  return (
    <View>
      <Card padding="md">
        <AppText variant="subheading">Platform</AppText>
        <ToggleRow
          label="Maintenance mode"
          hint="Members cannot create, edit or delete listings. Browsing keeps working and admins are unaffected."
          value={settings.maintenanceMode}
          disabled={busyId === 'maintenanceMode'}
          onValueChange={(next) => onSet('maintenanceMode', next)}
        />
        <ToggleRow
          label="Registration open"
          hint="When off, new accounts cannot sign up. Existing members can still sign in."
          value={settings.registrationOpen}
          disabled={busyId === 'registrationOpen'}
          onValueChange={(next) => onSet('registrationOpen', next)}
        />
      </Card>

      <Card padding="md" style={{ marginTop: 12 }}>
        <AppText variant="subheading">Categories</AppText>
        <AppText variant="caption" color="textMuted" style={{ marginTop: 4 }}>
          Hidden categories disappear from every tab in the app.
        </AppText>
        <View style={{ marginTop: 8 }}>
          {CATEGORY_OPTIONS.map((option) => {
            const on = !enabled.has(option.id);
            return (
              <View
                key={option.id}
                style={[styles.row, { borderBottomColor: theme.colors.border }]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <AppText variant="bodyMedium">{option.label}</AppText>
                  <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                    {on ? 'Visible' : 'Hidden from the app'}
                  </AppText>
                </View>
                <Switch
                  value={on}
                  disabled={busyId === 'disabledCategories' || (allHidden && enabled.has(option.id))}
                  onValueChange={() => toggleCategory(option.id)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  accessibilityLabel={`${option.label} visible`}
                />
              </View>
            );
          })}
        </View>
        {allHidden ? (
          <AppText variant="caption" color="danger" style={{ marginTop: 8 }}>
            At least one category must stay visible.
          </AppText>
        ) : null}
      </Card>

      <AppText variant="caption" color="textMuted" style={{ marginTop: 10 }}>
        Changes apply immediately everywhere the app reads them, including this
        device.
      </AppText>
    </View>
  );
}

/* ---------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  tabRow: {
    gap: 8,
    paddingRight: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  stat: {
    width: '48%',
    minWidth: 140,
    flexGrow: 1,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
