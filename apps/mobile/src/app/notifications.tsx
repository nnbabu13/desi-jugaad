/**=============================================================================
 * Notifications screen (Prompt.md §12)
 *
 * Displays the user's notifications: new messages, system alerts, and
 * other activity.
 * Tapping a notification navigates to the relevant screen (chat or
 * profile).
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/layout/back-header';
import { AppText } from '@/components/ui/app-text';
import { SignInRequired } from '@/components/sign-in-required';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/theme/use-theme';

interface NotificationItem {
  id?: string;
  type?: string;
  title?: string;
  body?: string;
  message?: string;
  actionUrl?: string;
  referenceType?: string;
  referenceId?: string | null;
  readAt?: string | null;
  createdAt?: string;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_ICON: Record<string, IoniconName> = {
  message: 'chatbubble-outline',
  payment: 'cash-outline',
  system: 'information-circle',
  verification: 'checkmark-circle',
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const { status: authStatus } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [marking, setMarking] = useState(false);
  const markingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);
    try {
      const res = await api.get<NotificationItem[]>('/notifications');
      setNotifications(res ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Session gone: offer sign-in rather than a retry that can never work.
        setUnauthorized(true);
        setNotifications([]);
      } else {
        setError(
          err instanceof ApiError ? err.message : 'Could not load notifications.',
        );
        setNotifications([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /** Clears the unread badge in place so the header updates immediately. */
  const markAllRead = useCallback(async () => {
    // Guard against double-taps firing duplicate POSTs.
    if (markingRef.current) return;
    markingRef.current = true;
    setMarking(true);
    try {
      await api.post('/notifications/read');
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? now })),
      );
    } catch {
      // Badge simply stays until the next successful load.
    } finally {
      markingRef.current = false;
      setMarking(false);
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
        heading="Notifications"
        title="Sign in to see your notifications"
        message="Messages, listing updates and alerts for your account appear here."
      />
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const filtered = notifications.filter((n) => {
    if (!query) return true;
    return (
      (n.title ?? '').toLowerCase().includes(query) ||
      (n.body ?? n.message ?? '').toLowerCase().includes(query) ||
      (n.type ?? '').toLowerCase().includes(query)
    );
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingState label="Loading notifications…" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorState
          title="Could not load notifications"
          message={error}
          onRetry={() => void load()}
        />
      </SafeAreaView>
    );
  }

  /** One notification row, extracted so the list can virtualize it. */
  const renderNotification = (n: NotificationItem, index: number) => {
    const title = n.title ?? 'Notification';
    const body = n.body ?? n.message ?? '';
    const when = n.createdAt ? new Date(n.createdAt) : null;
    const iconName = TYPE_ICON[n.type ?? ''] ?? 'information-circle';

    return (
      <Card
        key={n.id ?? index}
        elevated
        onPress={
          n.actionUrl ? () => router.push(n.actionUrl as Href) : undefined
        }
        style={{ marginBottom: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Ionicons name={iconName} size={22} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <AppText
                variant="bodyMedium"
                color={n.readAt ? 'textSecondary' : 'text'}
                style={{ flex: 1 }}
              >
                {title}
              </AppText>
              {!n.readAt ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.colors.secondary,
                  }}
                />
              ) : null}
            </View>
            {body ? (
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                {body}
              </AppText>
            ) : null}
            {when ? (
              <AppText variant="caption" color="textMuted" style={{ marginTop: 6 }}>
                {new Intl.DateTimeFormat('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(when)}
              </AppText>
            ) : null}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <BackHeader title="Notifications" fallback="/(tabs)" />
      <FlatList
        data={filtered}
        keyExtractor={(n, index) => n.id ?? String(index)}
        renderItem={({ item, index }) => renderNotification(item, index)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          <>
            {unreadCount > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 4,
                  marginBottom: 4,
                }}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.primaryTint,
                    borderRadius: theme.radius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <AppText variant="caption" color="primary">
                    {unreadCount} new
                  </AppText>
                </View>
                <Pressable
                  onPress={() => void markAllRead()}
                  disabled={marking}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all notifications as read"
                  accessibilityState={{ disabled: marking, busy: marking }}
                  hitSlop={8}
                  style={{ opacity: marking ? 0.5 : 1 }}
                >
                  <AppText variant="caption" color="primary">
                    {marking ? 'Marking…' : 'Mark all read'}
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            <View style={{ marginTop: 8 }}>
              <Input
                placeholder="Search notifications…"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={{ marginTop: 24 }}>
            <EmptyState
              title={query ? 'No matching notifications' : 'No notifications yet'}
              message={
                query
                  ? 'Try a different search term.'
                  : 'Messages, listing updates and community activity will appear here.'
              }
              icon="✦"
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
