/**
 * My drafts (Prompt.md §12).
 *
 * Every draft saved from the post form lands here, so nothing a user starts
 * is ever lost or unreachable. Drafts can be reopened for editing or
 * deleted, and the list renders proper loading / empty / error states.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/layout/back-header';
import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/states';
import { draftsRepo, Draft, formatDraftDate } from '@/lib/drafts';
import { postTypeById } from '@/lib/post-types';
import { useTheme } from '@/theme/use-theme';

export default function DraftsScreen() {
  const theme = useTheme();

  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setError(null);
    draftsRepo
      .list()
      .then(setDrafts)
      .catch((err) => {
        setError(err);
        setDrafts([]);
      });
  }, []);

  useEffect(() => {
    // Defer the kick-off so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      load();
    });
  }, [load]);

  function confirmDelete(draft: Draft) {
    Alert.alert(
      'Delete draft?',
      `“${draft.title}” will be removed from this device. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            draftsRepo
              .remove(draft.id)
              .then(load)
              .catch(() => setError(new Error('Could not delete the draft.')));
          },
        },
      ],
    );
  }

  function open(draft: Draft) {
    router.push({ pathname: '/post-form', params: { type: draft.type, draftId: draft.id } });
  }

  const loading = drafts === null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <BackHeader
        title="My drafts"
        subtitle="Stored on this device"
        fallback="/post"
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ padding: theme.layout.screenPadding, paddingBottom: theme.spacing.huge }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <SkeletonCard count={3} />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : drafts && drafts.length === 0 ? (
          <EmptyState
            icon="✎"
            title="No drafts yet"
            message="Start any of the seven post types and save it here to finish later."
            action={{ label: 'Open Post', onPress: () => router.replace('/post') }}
            secondaryAction={{ label: 'Go to Home', onPress: () => router.replace('/(tabs)') }}
          />
        ) : (
          drafts?.map((draft) => {
            const type = postTypeById(draft.type);
            return (
              <Card
                key={draft.id}
                padding="md"
                style={{ marginBottom: theme.spacing.md }}
                onPress={() => open(draft)}
                accessibilityLabel={`Edit draft ${draft.title}`}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardText}>
                    <AppText variant="bodyMedium" numberOfLines={2}>
                      {draft.title}
                    </AppText>

                    <View style={styles.cardMeta}>
                      <Badge label={type?.shortLabel ?? 'Draft'} tone="neutral" size="sm" />
                      <AppText variant="caption" color="textMuted" style={{ marginLeft: 6 }}>
                        Updated {formatDraftDate(draft.updatedAt)}
                      </AppText>
                    </View>

                    {!type ? (
                      <AppText variant="caption" color="danger" style={{ marginTop: 6 }}>
                        This posting type is no longer available.
                      </AppText>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => confirmDelete(draft)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete draft ${draft.title}`}
                    hitSlop={theme.layout.hitSlop}
                    style={({ pressed }) => [
                      styles.deleteBtn,
                      {
                        backgroundColor: theme.colors.dangerTint,
                        borderRadius: theme.radius.md,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}

        {drafts && drafts.length > 0 ? (
          <View style={{ marginTop: theme.spacing.sm }}>
            <Button
              label="Create a new draft"
              variant="outline"
              fullWidth
              onPress={() => router.replace('/post')}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardText: {
    flex: 1,
    paddingRight: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
