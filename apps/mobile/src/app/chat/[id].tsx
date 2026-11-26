/**=============================================================================
 * Chat (Prompt.md §12 - private chats)
 *
 * One conversation: the message thread with a host or member, plus a composer.
 * Loads `/messages/:id` from the API and renders honest loading / error /
 * empty states. No payment or compensation features appear here (§14).
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { goBackSafe } from '@/lib/nav';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type ScrollViewInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BackHeader } from '@/components/layout/back-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/use-theme';

interface Message {
  id: string;
  body?: string;
  text?: string;
  createdAt?: string;
  senderId?: string;
  authorId?: string;
}

/** Thread meta returned with GET /messages/:id. */
interface ThreadMeta {
  otherUserId?: string;
  otherUserName?: string;
  otherUserAvatar?: string | null;
  messages?: Message[];
}

export default function ChatScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const threadId = typeof params.id === 'string' ? params.id : undefined;

  const scrollRef = useRef<ScrollViewInstance>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<ThreadMeta>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const load = useCallback(async () => {
    if (!threadId) {
      setLoading(false);
      setError('Conversation not found.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ThreadMeta>(`/messages/${threadId}`);
      setMessages(res?.messages ?? []);
      setThread(res ?? {});
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load this conversation.',
      );
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    // Defer the kick-off so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      void load();
    });
  }, [load]);

  const otherName = thread.otherUserName ?? 'this member';

  /**
   * Blocks the other member (POST /users/me/blocks) and leaves the thread.
   * Server-side this also stops them messaging you; Settings lists the block
   * so it can be undone.
   */
  const blockUser = async () => {
    if (!thread.otherUserId || blocking) return;
    setBlocking(true);
    setSendError(null);
    try {
      await api.post('/users/me/blocks', { userId: thread.otherUserId });
      router.replace('/messages');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/auth-signin');
        return;
      }
      setSendError(
        err instanceof ApiError ? err.message : 'Could not block this member.',
      );
      setConfirmBlock(false);
    } finally {
      setBlocking(false);
    }
  };
  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !threadId) return;
    setSending(true);
    setSendError(null);
    try {
      const created = await api.post<Message>(`/messages/${threadId}`, { body });
      if (created) setMessages((prev) => [...prev, created]);
      setDraft('');
      // Keep the newest message in view.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setSendError(
        err instanceof ApiError ? err.message : 'Could not send your message.',
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <LoadingState label="Loading conversation…" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <ErrorState
          title="Could not load this conversation"
          message={error}
          onRetry={() => void load()}
          secondaryAction={{ label: 'Go back', onPress: () => goBackSafe() }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <BackHeader
        title={thread.otherUserName ?? 'Conversation'}
        subtitle="Private chat"
        fallback="/messages"
        actions={
          thread.otherUserId ? (
            <Pressable
              onPress={() => setConfirmBlock(true)}
              accessibilityRole="button"
              accessibilityLabel={`Block ${otherName}`}
              hitSlop={theme.layout.hitSlop}
              style={({ pressed }) => [
                { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="ban-outline" size={20} color={theme.colors.danger} />
            </Pressable>
          ) : null
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={{
            padding: theme.layout.screenPadding,
            paddingBottom: theme.spacing.lg,
          }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <EmptyState
              icon="💬"
              title="No messages yet"
              message="Send the first message to start this conversation."
            />
          ) : (
            messages.map((message, index) => {
              const mine =
                (message.senderId ?? message.authorId) !== undefined &&
                (message.senderId ?? message.authorId) === user?.id;
              const body = message.body ?? message.text ?? '';
              const when = message.createdAt ? new Date(message.createdAt) : null;

              return (
                <View
                  key={message.id ?? index}
                  style={[
                    styles.bubbleRow,
                    { justifyContent: mine ? 'flex-end' : 'flex-start' },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: mine
                          ? theme.colors.primary
                          : theme.colors.surface,
                        borderWidth: mine ? 0 : 1,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.lg,
                      },
                    ]}
                  >
                    <AppText variant="body" color={mine ? 'textInverse' : 'text'}>
                      {body}
                    </AppText>
                    {when ? (
                      <AppText
                        variant="caption"
                        color={mine ? 'textInverse' : 'textMuted'}
                        style={{ marginTop: 4, fontSize: 10 }}
                      >
                        {new Intl.DateTimeFormat('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(when)}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}

          {sendError ? (
            <AppText
              variant="caption"
              color="danger"
              style={{ marginTop: theme.spacing.sm }}
              accessibilityLiveRegion="polite"
            >
              {sendError}
            </AppText>
          ) : null}
        </ScrollView>

        {confirmBlock ? (
          <View
            style={[
              styles.composer,
              {
                borderTopColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 6,
                paddingVertical: 14,
              },
            ]}
          >
            <AppText variant="bodyMedium">
              Block {otherName}?
            </AppText>
            <AppText variant="caption" color="textMuted">
              They will no longer be able to message you. You can undo this
              later from Settings.
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancel"
                  variant="outline"
                  size="sm"
                  onPress={() => setConfirmBlock(false)}
                  disabled={blocking}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={blocking ? 'Blocking…' : 'Block'}
                  variant="danger"
                  size="sm"
                  loading={blocking}
                  onPress={() => void blockUser()}
                />
              </View>
            </View>
          </View>
        ) : (
        <View
          style={[
            styles.composer,
            { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message…"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Message"
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
            multiline
          />

          <Button
            label="Send"
            fullWidth={false}
            loading={sending}
            disabled={!draft.trim()}
            onPress={() => void send()}
          />
        </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
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
  headerText: { flex: 1, paddingRight: 12 },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 22,
  },
});
