/**=============================================================================
 * Messages screen (Prompt.md §12)
 *
 * Displays the user's conversations and allows messaging hosts or other users.
 * Lists active conversations with preview snippets and last activity time.
 *
 * Relies on the API's conversation endpoints and the auth user's session.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/layout/screen-header';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { SignInRequired } from '@/components/sign-in-required';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { router } from 'expo-router';
import { useTheme } from '@/theme/use-theme';

interface Conversation {
  id?: string;
  hostName?: string;
  otherUserName?: string;
  hostAvatar?: string | null;
  otherUserAvatar?: string | null;
  preview?: string;
  lastActive?: string;
  unreadCount?: number;
}

export default function MessagesScreen() {
  const theme = useTheme();
  const { status: authStatus } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);
    try {
      const res = await api.get<Conversation[]>('/messages/conversations');
      setConversations(res ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Session gone: offer sign-in rather than a retry that can never work.
        setUnauthorized(true);
        setConversations([]);
      } else {
        setError(
          err instanceof ApiError ? err.message : 'Could not load messages.',
        );
        setConversations([]);
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
        heading="Messages"
        title="Sign in to see your messages"
        message="Your conversations stay private to your account. Sign in to pick up any thread."
      />
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const filtered = conversations.filter((c) => {
    if (!query) return true;
    return (
      (c.hostName ?? '').toLowerCase().includes(query) ||
      (c.otherUserName ?? '').toLowerCase().includes(query) ||
      (c.preview ?? '').toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingState label="Loading messages…" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorState
          title="Could not load messages"
          message={error}
          onRetry={() => void load()}
        />
      </SafeAreaView>
    );
  }

  /** One conversation row, extracted so the list can virtualize it. */
  const renderConversation = (c: Conversation, index: number) => {
    const name = c.hostName || c.otherUserName || 'Member';
    const avatar = c.hostAvatar ?? c.otherUserAvatar ?? null;
    const lastMessage = c.preview || 'No messages yet';
    const when = c.lastActive ? new Date(c.lastActive) : null;
    const unread = c.unreadCount ?? 0;
    const conversationId = c.id;

    return (
      <Card
        key={c.id ?? index}
        elevated
        onPress={
          conversationId
            ? () =>
                router.push({
                  pathname: '/chat/[id]',
                  params: { id: conversationId },
                })
            : undefined
        }
        style={{ marginBottom: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={name} uri={avatar} size={48} />

          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AppText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                {name}
              </AppText>
              {when ? (
                <AppText variant="caption" color="textMuted">
                  {new Intl.DateTimeFormat('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(when)}
                </AppText>
              ) : null}
            </View>
            <AppText
              variant="caption"
              color={unread > 0 ? 'text' : 'textSecondary'}
              style={{ marginTop: 2 }}
              numberOfLines={1}
            >
              {lastMessage}
            </AppText>
          </View>

          {unread > 0 ? (
            <View
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                paddingHorizontal: 6,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
              }}
            >
              <AppText variant="caption" color="textInverse" style={{ fontSize: 11 }}>
                {unread > 99 ? '99+' : unread}
              </AppText>
            </View>
          ) : null}

          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Messages" />
      <FlatList
        data={filtered}
        keyExtractor={(c, index) => c.id ?? String(index)}
        renderItem={({ item, index }) => renderConversation(item, index)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginTop: 4 }}>
            <Input
              placeholder="Search conversations…"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={{ marginTop: 24 }}>
            <EmptyState
              title={query ? 'No matching conversations' : 'No conversations yet'}
              message={
                query
                  ? 'Try a different search term.'
                  : 'Start a conversation from a listing or community post.'
              }
              icon="✦"
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
