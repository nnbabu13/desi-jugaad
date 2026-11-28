/**=============================================================================
 * Help and support (Settings).
 *
 * Answers the questions members actually ask, in-app. Every entry points at
 * a real screen or a real action - no dead links, and the platform's limits
 * (no payments, no exact addresses) are stated honestly (Prompt.md §14).
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BackHeader } from '@/components/layout/back-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { router } from 'expo-router';
import { useTheme } from '@/theme/use-theme';

interface FaqEntry {
  q: string;
  a: string;
}

const FAQ: FaqEntry[] = [
  {
    q: 'How do I list a room?',
    a: 'Tap the centre Post button, choose "List a room or property", fill in the three steps and press Submit for review. An admin approves it, then your listing appears in Home, Explore and the rooms feed.',
  },
  {
    q: 'How do I contact a host about a room?',
    a: 'Open the listing and tap Message host. You will land in a private chat where you can ask about availability, rent and house rules, and exchange contact details directly.',
  },
  {
    q: 'Does Desi Jugaad take payments or bookings?',
    a: 'No. Desi Jugaad never handles payment, deposits or reservations for accommodation, services or parcel help. Everything is arranged directly between the two people.',
  },
  {
    q: 'How do I change my city?',
    a: 'Explore has a country and city list - tap a city to make it yours. You can also change it from Settings, Location preferences. Home re-renders around the new city.',
  },
  {
    q: 'Why can only my neighbourhood show, not my address?',
    a: 'For safety, listings only ever store and show a neighbourhood label. Exact residential addresses are never published (Prompt.md 3).',
  },
  {
    q: 'How do I stop someone messaging me?',
    a: 'Open the conversation and tap the block icon in the header. The block is listed under Settings, Blocked accounts, where you can undo it at any time.',
  },
  {
    q: 'How do I verify my account?',
    a: 'Verify your email from your profile or Settings. A verified badge only ever appears after the check really passes - demo accounts never show one.',
  },
];

export default function HelpScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <BackHeader
        title="Help and support"
        subtitle="How Desi Jugaad works"
        fallback="/settings"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {FAQ.map((entry) => (
          <Card key={entry.q} padding="md" style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Ionicons
                name="help-circle-outline"
                size={18}
                color={theme.colors.primary}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium">{entry.q}</AppText>
                <AppText
                  variant="body"
                  color="textSecondary"
                  style={{ marginTop: 6 }}
                >
                  {entry.a}
                </AppText>
              </View>
            </View>
          </Card>
        ))}

        <Card padding="md" style={{ marginTop: 6 }}>
          <AppText variant="subheading">Still need help?</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 6 }}>
            The fastest answer usually comes from your city community - ask
            there and locals or our team can reply.
          </AppText>
          <View style={{ marginTop: 14, gap: 10 }}>
            <Button
              label="Ask the community"
              fullWidth
              onPress={() => router.push('/post-form?type=ask-community')}
            />
            <Button
              label="Browse listings"
              variant="outline"
              fullWidth
              onPress={() => router.push('/rooms')}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
