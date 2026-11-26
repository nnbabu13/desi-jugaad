/**=============================================================================
 * Blocked accounts (Settings).
 *
 * Lists the members the signed-in user has blocked (GET /users/me/blocks)
 * with a working Unblock action per row. Blocking itself happens from a
 * conversation (chat header), where the other member is known.
 *
 * Anonymous visitors get the shared sign-in prompt instead of a dead 401.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { goBackSafe } from '@/lib/nav';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BackHeader } from '@/components/layout/back-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SignInRequired } from '@/components/sign-in-required';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/use-theme';

interface BlockedMember {
  id: string;
  fullName?: string;
  avatarUrl?: string | null;
  blockedAt?: string;
}

export default function BlockedAccountsScreen() {
  const theme = useTheme();
  const { status: authStatus } = useAuth();

  const [members, setMembers] = useState<BlockedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<BlockedMember[]>('/users/me/blocks');
      setMembers(res ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load blocked accounts.',
      );
      setMembers([]);
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

  const unblock = async (member: BlockedMember) => {
    if (unblockingId) return;
    setUnblockingId(member.id);
    try {
      await api.delete(`/users/me/blocks/${member.id}`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch {
      // Keep the row; the next load or retry will re-sync with the server.
    } finally {
      setUnblockingId(null);
    }
  };

  if (authStatus === 'anonymous') {
    return (
      <SignInRequired
        heading="Blocked accounts"
        title="Sign in to manage blocked accounts"
        message="The people you have blocked are private to your account."
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <LoadingState label="Loading blocked accounts…" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorState
          title="Could not load blocked accounts"
          message={error}
          onRetry={() => void load()}
          secondaryAction={{ label: 'Go back', onPress: () => goBackSafe() }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <BackHeader
        title="Blocked accounts"
        subtitle="Members who cannot message you"
        fallback="/settings"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {members.length === 0 ? (
          <Card padding="lg" style={{ marginTop: 8 }}>
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Ionicons
                name="shield-checkmark-outline"
                size={34}
                color={theme.colors.primary}
              />
              <AppText variant="subheading" style={{ marginTop: 12 }}>
                No blocked accounts
              </AppText>
              <AppText
                variant="body"
                color="textSecondary"
                align="center"
                style={{ marginTop: 6 }}
              >
                If someone bothers you, open your conversation with them and
                tap the block icon. They will not be able to message you again.
              </AppText>
              <View style={{ marginTop: 16 }}>
                <Button
                  label="Go back"
                  variant="outline"
                  onPress={() => goBackSafe()}
                />
              </View>
            </View>
          </Card>
        ) : (
          members.map((member) => (
            <Card
              key={member.id}
              padding="md"
              style={{ marginBottom: 10 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Avatar name={member.fullName ?? 'Member'} uri={member.avatarUrl} size={44} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {member.fullName ?? 'Member'}
                  </AppText>
                  <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                    {member.blockedAt
                      ? `Blocked ${new Date(member.blockedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}`
                      : 'Blocked'}
                  </AppText>
                </View>
                <Button
                  label={unblockingId === member.id ? 'Unblocking…' : 'Unblock'}
                  variant="outline"
                  size="sm"
                  loading={unblockingId === member.id}
                  onPress={() => void unblock(member)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
