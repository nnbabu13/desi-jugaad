/**=============================================================================
 * Host dashboard (Prompt.md §12)
 *
 * Displays host-specific statistics and management actions.
 * Shows live listings, active threads, unread enquiries, and profile
 * management options for the logged-in host.
 *
 * Navigation: Accessible from the tab bar or profile menu.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BackHeader } from '@/components/layout/back-header';
import { SignInRequired } from '@/components/sign-in-required';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { router } from 'expo-router';
import { useTheme } from '@/theme/use-theme';

interface HostStats {
  totalListings: number;
  activeListings: number;
  conversations: number;
  unreadMessages: number;
}

const EMPTY_STATS: HostStats = {
  totalListings: 0,
  activeListings: 0,
  conversations: 0,
  unreadMessages: 0,
};

export default function HostDashboardScreen() {
  const theme = useTheme();
  const { status: authStatus } = useAuth();

  const [stats, setStats] = useState<HostStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);
    try {
      const res = await api.get<Partial<HostStats>>('/host/stats');
      setStats({ ...EMPTY_STATS, ...(res ?? {}) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Session gone: offer sign-in rather than a retry that can never work.
        setUnauthorized(true);
        setStats(EMPTY_STATS);
      } else {
        setError(
          err instanceof ApiError ? err.message : 'Could not load host stats.',
        );
        setStats(EMPTY_STATS);
      }
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

  if (authStatus === 'anonymous' || unauthorized) {
    return (
      <SignInRequired
        heading="Host dashboard"
        title="Sign in to manage your listings"
        message="Your listings, conversations and unread messages are private to your account."
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingState label="Loading dashboard…" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorState
          title="Could not load dashboard"
          message={error}
          onRetry={() => void load()}
        />
      </SafeAreaView>
    );
  }

  const tiles: { value: string; label: string; icon: string }[] = [
    {
      value: stats.totalListings.toLocaleString(),
      label: 'Listings',
      icon: 'home-outline',
    },
    {
      value: stats.activeListings.toLocaleString(),
      label: 'Active now',
      icon: 'eye-outline',
    },
    {
      value: stats.conversations.toLocaleString(),
      label: 'Conversations',
      icon: 'chatbubbles-outline',
    },
    {
      value: stats.unreadMessages.toLocaleString(),
      label: 'Unread messages',
      icon: 'mail-unread-outline',
    },
  ];

  const actions: { label: string; icon: string; onPress: () => void }[] = [
    { label: 'My listings', icon: 'home-outline', onPress: () => router.push('/my-listings') },
    { label: 'Create listing', icon: 'add', onPress: () => router.push('/post') },
    {
      label: 'Messages',
      icon: 'chatbubbles-outline',
      onPress: () => router.push('/messages'),
    },
    {
      label: 'My drafts',
      icon: 'save-outline',
      onPress: () => router.push('/drafts'),
    },
    {
      label: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => router.push('/notifications'),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <BackHeader
        title="Host dashboard"
        subtitle="Your listings and enquiries"
        fallback="/(tabs)"
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 8,
          }}
        >
          {tiles.map((tile) => (
            <Card
              key={tile.label}
              elevated
              style={{ width: '47%', flexGrow: 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name={tile.icon as never}
                  size={18}
                  color={theme.colors.primary}
                />
                <AppText variant="caption" color="textMuted">
                  {tile.label}
                </AppText>
              </View>
              <AppText variant="heading" style={{ marginTop: 8 }}>
                {tile.value}
              </AppText>
            </Card>
          ))}
        </View>

        <View style={{ marginTop: 24 }}>
          <AppText variant="subheading">Quick actions</AppText>
          <View style={{ marginTop: 12, gap: 10 }}>
            {actions.map((action) => (
              <Button
                key={action.label}
                label={action.label}
                variant="outline"
                fullWidth
                onPress={action.onPress}
                icon={
                  <Ionicons
                    name={action.icon as never}
                    size={18}
                    color={theme.colors.primary}
                  />
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
