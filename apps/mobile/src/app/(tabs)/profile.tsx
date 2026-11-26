/**=============================================================================
 * Profile screen (Prompt.md §11).
 *
 * The member's own profile, built entirely from real API data:
 *   - hero card: avatar (real image with initials fallback), name, trust
 *     signals, verification prompt and current location;
 *   - about card: bio, life stage and languages, with an empty state that
 *     deep-links into the edit sheet (never a dead end);
 *   - activity card: live host stats (listings, conversations, unread);
 *   - menu: host dashboard, drafts, notifications, settings and sign out.
 *
 * Demo accounts: `demoData=true`, no verified rows -> "Sample" chip, never a
 * verified badge. Policy enforcement is structural (badge.tsx / TrustRow).
 *
 * Editing happens in ProfileEditSheet, a single overlay that writes through
 * the auth store so this screen re-renders from the server response.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState, useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileEditSheet } from '@/components/profile-edit-sheet';
import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText } from '@/components/ui/app-text';
import { TrustRow } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { verificationStatusOf } from '@/lib/api-types';
import { useAuth } from '@/stores/auth';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useTheme } from '@/theme/use-theme';

interface HostStats {
  totalListings: number;
  activeListings: number;
  conversations: number;
  unreadMessages: number;
}

const LIFE_STAGE_LABELS: Record<string, string> = {
  living_abroad: 'Living abroad',
  student_abroad: 'Student abroad',
  planning_to_move: 'Planning to move',
  other: 'Other',
};

type IoniconName = keyof typeof Ionicons.glyphMap;

interface MenuRow {
  icon: IoniconName;
  label: string;
  hint: string;
  href: Href;
}

const MENU: MenuRow[] = [
  { icon: 'home-outline', label: 'Host dashboard', hint: 'Listings and enquiries', href: '/host-dashboard' },
  { icon: 'document-text-outline', label: 'My drafts', hint: 'Listings you have not published', href: '/drafts' },
  { icon: 'notifications-outline', label: 'Notifications', hint: 'Messages and activity', href: '/notifications' },
  { icon: 'settings-outline', label: 'Settings', hint: 'Account, privacy and legal', href: '/settings' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, status: authStatus, logout } = useAuth();
  const params = useLocalSearchParams<{ edit?: string }>();
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;

  const [editing, setEditing] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Settings links here with ?edit=1 to open the editor directly. The param
  // is cleared after opening so a later visit to the tab starts closed.
  useFocusEffect(
    useCallback(() => {
      if (editParam !== '1') return;
      Promise.resolve().then(() => setEditing(true));
      void router.setParams({ edit: undefined });
    }, [editParam]),
  );

  const [stats, setStats] = useState<HostStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsError(null);
    try {
      const res = await api.get<Partial<HostStats>>('/host/stats');
      setStats({
        totalListings: res?.totalListings ?? 0,
        activeListings: res?.activeListings ?? 0,
        conversations: res?.conversations ?? 0,
        unreadMessages: res?.unreadMessages ?? 0,
      });
    } catch (err) {
      setStats(null);
      setStatsError(
        err instanceof ApiError ? err.message : 'Could not load activity.',
      );
    }
  }, []);

  useEffect(() => {
    // Defer the kick-off so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      void loadStats();
    });
  }, [loadStats]);

  const doSignOut = async () => {
    setConfirmSignOut(false);
    await logout();
    router.replace('/auth-signin');
  };

  /* --------------------------- loading / empty -------------------------- */

  if (authStatus === 'loading') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingState label="Loading profile…" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorState
          title="Not signed in"
          message="Sign in to see your profile, listings and messages."
          retryLabel="Sign in"
          onRetry={() => router.replace('/auth-signin')}
          secondaryAction={{ label: 'Go to Home', onPress: () => router.replace('/(tabs)') }}
        />
      </SafeAreaView>
    );
  }

  const profile = user.profile;
  const fullName = profile?.fullName || user.email.split('@')[0];
  const bio = profile?.bio ?? '';
  const lifeStage = profile?.lifeStage ?? '';
  const languages = profile?.languages ?? [];
  const demoData = profile?.demoData ?? false;
  const avatarUrl = profile?.avatarUrl ?? null;
  const currentCountry = profile?.currentCountry ?? null;
  const currentCity = profile?.currentCity ?? null;

  const hasAbout = Boolean(bio || lifeStage || languages.length > 0);
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });

  const activityTiles: { value: number; label: string; icon: IoniconName }[] = [
    { value: stats?.totalListings ?? 0, label: 'Listings', icon: 'home-outline' },
    { value: stats?.conversations ?? 0, label: 'Conversations', icon: 'chatbubbles-outline' },
    { value: stats?.unreadMessages ?? 0, label: 'Unread', icon: 'mail-outline' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Profile"
        actions={[
          { icon: 'settings-outline', label: 'Settings', onPress: () => router.push('/settings') },
        ]}
      />

      <ScrollView
        contentContainerStyle={{
          padding: theme.layout.screenPadding,
          paddingBottom: theme.spacing.huge,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------ hero ---------------------------- */}
        <Card elevated style={{ borderRadius: theme.radius.lg }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <Avatar name={fullName} uri={avatarUrl} size="xl" ring />

            <AppText variant="heading" align="center" style={{ marginTop: 12 }}>
              {fullName}
            </AppText>

            <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
              {user.email} · Member since {memberSince}
            </AppText>

            <View style={{ marginTop: 10 }}>
              <TrustRow isDemo={demoData} verificationStatus={verificationStatusOf(user.verifications)} />
            </View>
          </View>

          {/* Location row */}
          <Pressable
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit location"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              padding: 12,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceSunken,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="location-outline" size={18} color={theme.colors.secondary} />
            <View style={{ flex: 1 }}>
              {currentCountry ? (
                <>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {currentCity ? `${currentCity.name}, ` : ''}
                    {currentCountry.name}
                  </AppText>
                  <AppText variant="caption" color="textMuted" style={{ marginTop: 1 }}>
                    Current location
                  </AppText>
                </>
              ) : (
                <>
                  <AppText variant="bodyMedium">Set your location</AppText>
                  <AppText variant="caption" color="textMuted" style={{ marginTop: 1 }}>
                    Home content follows the city you pick
                  </AppText>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>

          <Button
            label="Edit profile"
            variant="outline"
            fullWidth
            style={{ marginTop: 12 }}
            onPress={() => setEditing(true)}
            icon={
              <Ionicons
                name="create-outline"
                size={18}
                color={theme.colors.primary}
                style={{ marginRight: 8 }}
              />
            }
          />
        </Card>

        {/* ------------------------------ about --------------------------- */}
        <View style={{ marginTop: 16 }}>
          <AppText variant="subheading">About</AppText>
          <Card style={{ marginTop: 8 }}>
            {hasAbout ? (
              <>
                {bio ? (
                  <AppText variant="body" color="textSecondary">
                    {bio}
                  </AppText>
                ) : null}

                {lifeStage ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: bio ? 12 : 0,
                    }}
                  >
                    <Ionicons name="compass-outline" size={16} color={theme.colors.secondary} />
                    <AppText variant="bodyMedium">
                      {LIFE_STAGE_LABELS[lifeStage] ?? lifeStage}
                    </AppText>
                  </View>
                ) : null}

                {languages.length > 0 ? (
                  <View style={{ marginTop: bio || lifeStage ? 14 : 0 }}>
                    <AppText variant="caption" color="textMuted">
                      Languages
                    </AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {languages.map((language) => (
                        <View
                          key={language}
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: theme.colors.surfaceSunken,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                          }}
                        >
                          <AppText variant="caption" color="textSecondary">
                            {language}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <View>
                <AppText variant="body" color="textMuted">
                  Add a short bio, your life stage and the languages you speak, so hosts know
                  who they are talking to.
                </AppText>
                <Button
                  label="Add details"
                  variant="outline"
                  size="sm"
                  style={{ marginTop: 12 }}
                  onPress={() => setEditing(true)}
                />
              </View>
            )}
          </Card>
        </View>

        {/* ---------------------------- activity -------------------------- */}
        <View style={{ marginTop: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="subheading">Your activity</AppText>
            <Pressable
              onPress={() => router.push('/host-dashboard')}
              accessibilityRole="button"
              accessibilityLabel="Open host dashboard"
              hitSlop={8}
            >
              <AppText variant="caption" color="primary">
                Dashboard ›
              </AppText>
            </Pressable>
          </View>

          <Card style={{ marginTop: 8 }}>
            {statsError ? (
              <View>
                <AppText variant="caption" color="danger">
                  {statsError}
                </AppText>
                <Button
                  label="Try again"
                  variant="outline"
                  size="sm"
                  style={{ marginTop: 10 }}
                  onPress={() => void loadStats()}
                />
              </View>
            ) : !stats ? (
              <AppText variant="body" color="textMuted">
                Loading activity…
              </AppText>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {activityTiles.map((tile) => (
                  <Pressable
                    key={tile.label}
                    onPress={() => router.push('/host-dashboard')}
                    accessibilityRole="button"
                    accessibilityLabel={`${tile.value} ${tile.label}`}
                    style={({ pressed }) => ({
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surfaceSunken,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <Ionicons name={tile.icon} size={18} color={theme.colors.primary} />
                    <AppText variant="heading" style={{ marginTop: 6 }}>
                      {tile.value}
                    </AppText>
                    <AppText variant="caption" color="textMuted" numberOfLines={1}>
                      {tile.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            )}
          </Card>
        </View>

        {/* ------------------------------ menu ---------------------------- */}
        <View style={{ marginTop: 16 }}>
          <AppText variant="subheading">Account</AppText>
          <Card padding="none" style={{ marginTop: 8 }}>
            {MENU.map((row, index) => (
              <Pressable
                key={row.label}
                onPress={() => router.push(row.href)}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderColor: theme.colors.border,
                })}
              >
                <Ionicons name={row.icon} size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{row.label}</AppText>
                  <AppText variant="caption" color="textMuted" style={{ marginTop: 1 }}>
                    {row.hint}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>
            ))}
          </Card>
        </View>

        {/* ---------------------------- sign out -------------------------- */}
        <View style={{ marginTop: 16 }}>
          {confirmSignOut ? (
            <Card style={{ borderColor: theme.colors.danger }}>
              <AppText variant="bodyMedium">Sign out of Desi Jugaad?</AppText>
              <AppText
                variant="caption"
                color="textMuted"
                style={{ marginTop: 4, marginBottom: 12 }}
              >
                Your drafts and messages stay safe on your account.
              </AppText>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Stay signed in"
                    variant="outline"
                    size="sm"
                    onPress={() => setConfirmSignOut(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Sign out" variant="danger" size="sm" onPress={() => void doSignOut()} />
                </View>
              </View>
            </Card>
          ) : (
            <Button
              label="Sign out"
              variant="ghost"
              fullWidth
              onPress={() => setConfirmSignOut(true)}
              icon={
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color={theme.colors.danger}
                  style={{ marginRight: 8 }}
                />
              }
            />
          )}
        </View>
      </ScrollView>

      {editing ? <ProfileEditSheet onClose={() => setEditing(false)} /> : null}
    </SafeAreaView>
  );
}
