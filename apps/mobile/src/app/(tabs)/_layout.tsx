/**=============================================================================
 * Tab navigator.
 *
 * Provides the 5-tab bar (Home · Explore · Post · Messages · Profile) with a
 * visually prominent Post button. Post does not switch tabs — it presents the
 * posting sheet as a transparent modal over the current screen.
 *
 * The tab items are registered declaratively so Expo Router can resolve deep
 * links; the visible bar is a custom `tabBar` so the Post action can be raised
 * and independent of the tab switching logic.
 *
 * The Messages tab carries a live unread badge, re-counted from
 * GET /messages/conversations whenever the route changes (so leaving a thread
 * you just read updates it) and cleared whenever nobody is signed in.
 *=============================================================================*/

import { Tabs, router, useSegments } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';

import {
  PostButton,
  TabBarShell,
  TabButton,
  TAB_ITEMS,
} from '@/components/navigation/tab-bar';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';

export default function TabsLayout() {
  const { status } = useAuth();
  const segments = useSegments();
  const segmentsKey = segments.join('/');
  const [unread, setUnread] = useState(0);

  const refreshBadge = useCallback(async () => {
    if (status !== 'authenticated') {
      setUnread(0);
      return;
    }
    try {
      const rows = await api.get<{ unreadCount?: number }[]>(
        '/messages/conversations',
      );
      setUnread(
        (rows ?? []).reduce((sum, row) => sum + (row.unreadCount ?? 0), 0),
      );
    } catch {
      // Keep the previous badge rather than flashing it away on a blip.
    }
  }, [status]);

  useEffect(() => {
    // Defer the kick-off so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      void refreshBadge();
    });
  }, [refreshBadge, segmentsKey]);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => (
        <TabBarShell>
          {TAB_ITEMS.map((item, index) => (
            <Fragment key={item.name}>
              {/* The raised centre action sits between Explore and Messages. */}
              {index === 2 ? <PostButton onPress={() => router.push('/post')} /> : null}
              <TabButton
                item={
                  item.name === 'messages' && unread > 0
                    ? { ...item, badge: unread }
                    : item
                }
                isFocused={state.index === index}
                onPress={() => router.navigate(item.href)}
              />
            </Fragment>
          ))}
        </TabBarShell>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
