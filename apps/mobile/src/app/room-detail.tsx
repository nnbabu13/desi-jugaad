/**=============================================================================
 * Room detail screen (Prompt.md §12)
 *
 * Displays full details for a single room/listing.
 * Shows gallery, amenities, landlord info, and the message-host action.
 *
 * Navigation: `/room-detail?id=…` → shows the room details.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { goBackSafe } from '@/lib/nav';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BackHeader } from '@/components/layout/back-header';
import { AppText } from '@/components/ui/app-text';
import { TrustRow } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError, api } from '@/lib/api';
import { useTheme } from '@/theme/use-theme';

interface Room {
  id: string;
  title?: string;
  rent?: number;
  currency?: string;
  accommodationType?: string;
  furnished?: string;
  city?: string;
  address?: string;
  description?: string;
  landlordName?: string;
  landlordAvatar?: string | null;
  photos?: string[];
  /** Seeded/sample records must show a "Sample" chip, never a badge. */
  demoData?: boolean;
}

const ACCOMMODATION_LABELS: Record<string, string> = {
  room_shared: 'Room in a shared home',
  room_private: 'Room with private bathroom',
  entire_flat: 'Entire flat',
  shared_house: 'Shared house',
  studio: 'Studio',
};

function furnishedLabel(value?: string): string {
  if (value === 'furnished') return 'Furnished';
  if (value === 'part_furnished') return 'Part-furnished';
  return 'Unfurnished';
}

export default function RoomDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const roomId = typeof params.id === 'string' ? params.id : undefined;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!roomId) {
      setLoading(false);
      setError('Room not found.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Room>(`/rooms/${roomId}`);
      setRoom(res ?? null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load room.',
      );
      setRoom(null);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    // Defer the kick-off so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      void load();
    });
  }, [load]);

  /**
   * Opens (or starts) the thread for this listing and jumps straight into
   * the chat, so "Message host" never lands on a dead-end empty inbox.
   * Busy-guarded against double-taps; signed-out visitors are routed to
   * sign-in, and any other failure is shown inline instead of silently
   * navigating away.
   */
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const messageHost = useCallback(async () => {
    if (!roomId || messaging) return;
    setMessaging(true);
    setMessageError(null);
    try {
      const conv = await api.post<{ id?: string }>('/messages/conversations', {
        roomId,
      });
      if (conv?.id) {
        router.push({ pathname: '/chat/[id]', params: { id: conv.id } });
        return;
      }
      router.push('/messages');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/auth-signin');
        return;
      }
      setMessageError(
        err instanceof ApiError
          ? err.message
          : 'Could not open the conversation. Please try again.',
      );
    } finally {
      setMessaging(false);
    }
  }, [roomId, messaging]);

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={['top']}
      >
        <LoadingState label="Loading room details…" />
      </SafeAreaView>
    );
  }

  if (error || !room) {
    const notFound = !error;
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={['top']}
      >
        {notFound ? (
          <EmptyState
            title="Room not found"
            message="The room you requested could not be found."
            icon="⌕"
            action={{ label: 'Go back', onPress: () => goBackSafe() }}
            secondaryAction={{
              label: 'Browse rooms',
              onPress: () => router.replace('/rooms'),
            }}
          />
        ) : (
          <ErrorState
            title="Could not load this room"
            message={error ?? ''}
            onRetry={() => void load()}
            secondaryAction={{ label: 'Go back', onPress: () => goBackSafe() }}
          />
        )}
      </SafeAreaView>
    );
  }

  const rent = room.rent ?? 0;
  const currency = room.currency || 'GBP';
  const title = room.title?.trim() || 'Listing';
  const accType = room.accommodationType || 'room_private';
  // Neighbourhood + city, but only what actually exists - never a invented
  // placeholder like "Unknown".
  const locationLine = [room.address, room.city].filter(Boolean).join(', ');
  const description = room.description || '';
  const landlordName = room.landlordName || 'Host';
  const photos = room.photos ?? [];
  const demoData = room.demoData ?? false;
  const accLabel = ACCOMMODATION_LABELS[accType] ?? accType;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top']}
    >
      <BackHeader title="Listing" fallback="/rooms" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Card elevated style={{ marginTop: 4 }}>
          <AppText variant="heading">{title}</AppText>
          {locationLine ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginTop: 6,
              }}
            >
              <Ionicons
                name="location-outline"
                size={14}
                color={theme.colors.textMuted}
              />
              <AppText variant="caption" color="textSecondary">
                {locationLine}
              </AppText>
            </View>
          ) : null}
          {rent > 0 ? (
            <AppText variant="title" style={{ marginTop: 10 }}>
              {rent.toLocaleString()} {currency}
              <AppText variant="caption" color="textMuted">
                {' '}
                / month
              </AppText>
            </AppText>
          ) : null}
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 6 }}>
            {accLabel}
            {room.furnished ? ` · ${furnishedLabel(room.furnished)}` : ''}
          </AppText>
        </Card>

        <Card elevated style={{ marginTop: 12 }}>
          <AppText variant="subheading">Description</AppText>
          <AppText
            variant="body"
            color="textSecondary"
            style={{ marginTop: 8 }}
          >
            {description || 'No description available.'}
          </AppText>
        </Card>

        {photos.length > 0 ? (
          <Card elevated style={{ marginTop: 12 }}>
            <AppText variant="subheading">Photos</AppText>
            <View
              style={{
                marginTop: 10,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {photos.slice(0, 6).map((photo, index) => (
                <RoomPhoto
                  key={`${photo}-${index}`}
                  uri={photo}
                  index={index}
                />
              ))}
            </View>
          </Card>
        ) : null}

        <Card elevated style={{ marginTop: 12 }}>
          <AppText variant="subheading">Host</AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 10,
              gap: 10,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.colors.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="person-outline"
                size={22}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium">{landlordName}</AppText>
              <View style={{ marginTop: 4 }}>
                <TrustRow isDemo={demoData} />
              </View>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 20, gap: 10 }}>
          <Pressable
            onPress={() => void messageHost()}
            disabled={messaging}
            accessibilityRole="button"
            accessibilityLabel="Message host"
            accessibilityState={{ busy: messaging, disabled: messaging }}
            style={{
              padding: 16,
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: messaging ? 0.6 : 1,
            }}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={20}
              color={theme.colors.textOnPrimary}
            />
            <AppText variant="bodyMedium" color="textInverse">
              {messaging ? 'Opening…' : 'Message host'}
            </AppText>
          </Pressable>

          {messageError ? (
            <AppText
              variant="caption"
              color="danger"
              accessibilityLiveRegion="polite"
            >
              {messageError}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One gallery thumbnail. Loads with a transition over a neutral skeleton and
 * degrades to a placeholder icon if the remote photo fails, so a dead CDN
 * link never renders as a broken-image box.
 */
function RoomPhoto({ uri, index }: { uri: string; index: number }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  return (
    <View
      style={{
        width: 80,
        height: 80,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {failed ? (
        <Ionicons name="image-outline" size={24} color={theme.colors.textMuted} />
      ) : (
        <Image
          source={{ uri }}
          style={{ width: 80, height: 80 }}
          contentFit="cover"
          transition={200}
          onError={() => setFailed(true)}
          alt={`Listing photo ${index + 1}`}
        />
      )}
    </View>
  );
}
