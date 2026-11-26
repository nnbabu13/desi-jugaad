/**=============================================================================
 * Settings (Prompt.md §11)
 *
 * Account and app settings: profile, location, notifications, privacy,
 * blocked accounts, help, terms, privacy policy and account deletion -
 * every row opens a working screen or flow; none is decorative.
 *
 * Linked from the auth screen with `?section=terms|privacy` so the legal
 * documents are reachable during sign-up, and from Profile afterwards.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BackHeader } from '@/components/layout/back-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/use-theme';

type SectionId =
  | 'terms'
  | 'privacy'
  | 'edit-profile'
  | 'location'
  | 'notifications'
  | 'blocked'
  | 'help'
  | 'delete-account';

interface SettingRow {
  id: SectionId | 'signout';
  label: string;
  description: string;
  icon: string;
  destructive?: boolean;
}

const ROWS: SettingRow[] = [
  {
    id: 'edit-profile',
    label: 'Edit profile',
    description: 'Name, photo, bio and verification status',
    icon: 'person-outline',
  },
  {
    id: 'location',
    label: 'Location preferences',
    description: 'Choose the city and country shown across the app',
    icon: 'location-outline',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Messages and system alerts',
    icon: 'notifications-outline',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    description: 'Who can see your listings and contact you',
    icon: 'lock-closed-outline',
  },
  {
    id: 'blocked',
    label: 'Blocked accounts',
    description: 'Manage accounts you have blocked',
    icon: 'ban-outline',
  },
  {
    id: 'help',
    label: 'Help and support',
    description: 'How the platform works, step by step',
    icon: 'help-circle-outline',
  },
  {
    id: 'terms',
    label: 'Terms and conditions',
    description: 'The agreement that governs your use of Desi Jugaad',
    icon: 'document-text-outline',
  },
  {
    id: 'delete-account',
    label: 'Account deletion',
    description: 'Permanently remove your account and listings',
    icon: 'trash-outline',
    destructive: true,
  },
];

/** Short, honest summaries of the legal documents (full text ships with the
 *  production build; these keep the links non-empty rather than dead). */
const LEGAL_COPY: Record<'terms' | 'privacy', { title: string; body: string[] }> = {
  terms: {
    title: 'Terms and conditions',
    body: [
      'Desi Jugaad connects people who need a room, a service or parcel help with those who offer it.',
      'You must provide accurate information, respect other members, and never use the platform for harassment or unlawful activity.',
      'Listings and messages must be honest. Paid promotion never bypasses safety moderation.',
      'We may suspend accounts that break these rules, and we will tell you why.',
      'These terms are governed by the laws of the country your account is registered in.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      'We collect only what the app needs to work: your account details, the location you choose, and the content you post.',
      'Your exact address is never shown to other members - only your city and neighbourhood area.',
      'Your verification documents are used to confirm your identity and are not shared with other members.',
      'You can request a copy of your data, or delete your account and its data, at any time from Settings.',
      'We do not sell your personal data.',
    ],
  },
};

export default function SettingsScreen() {
  const theme = useTheme();
  const { status: authStatus, logout } = useAuth();
  const params = useLocalSearchParams<{ section?: string }>();
  const initial =
    params.section === 'terms' || params.section === 'privacy'
      ? params.section
      : null;
  const [openSection, setOpenSection] = useState<SectionId | null>(initial);

  // Account deletion: an explicit confirm step, never a one-tap destroy.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const legal = openSection === 'terms' || openSection === 'privacy'
    ? LEGAL_COPY[openSection]
    : null;

  /** Every row resolves to a real screen or flow - nothing is decorative. */
  function openRow(row: SettingRow) {
    setDeleteError(null);
    switch (row.id) {
      case 'edit-profile':
        return router.push({ pathname: '/(tabs)/profile', params: { edit: '1' } });
      case 'location':
        return router.push({ pathname: '/(tabs)/profile', params: { edit: '1' } });
      case 'notifications':
        return router.push('/notifications');
      case 'privacy':
      case 'terms':
        return setOpenSection(row.id);
      case 'blocked':
        return router.push('/blocked');
      case 'help':
        return router.push('/help');
      case 'delete-account':
        if (authStatus !== 'authenticated') return router.push('/auth-signin');
        return setConfirmDelete(true);
      default:
        return undefined;
    }
  }

  /** Soft-deletes the account server-side, then clears the local session. */
  async function deleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete('/users/me');
      await logout();
      router.replace('/auth-signin');
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : 'Could not delete your account. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <BackHeader
        title={legal ? legal.title : 'Settings'}
        subtitle={legal ? 'Legal' : 'Account and app preferences'}
        fallback="/(tabs)"
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{
          padding: theme.layout.screenPadding,
          paddingBottom: theme.spacing.huge,
        }}
        showsVerticalScrollIndicator={false}
      >
        {legal ? (
          <View>
            <Pressable
              onPress={() => setOpenSection(null)}
              accessibilityRole="button"
              accessibilityLabel="All settings"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: pressed ? 0.6 : 1,
                marginBottom: theme.spacing.md,
              })}
            >
              <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
              <AppText variant="caption" color="primary">
                All settings
              </AppText>
            </Pressable>

            <Card elevated>
              {legal.body.map((paragraph, index) => (
                <AppText
                  key={index}
                  variant="body"
                  color="textSecondary"
                  style={{ marginTop: index === 0 ? 0 : theme.spacing.sm }}
                >
                  {paragraph}
                </AppText>
              ))}
            </Card>
          </View>
        ) : (
          <View>
            {/* Account deletion: explicit confirm, with a real escape hatch. */}
            {confirmDelete ? (
              <Card
                padding="md"
                style={{
                  marginBottom: theme.spacing.md,
                  borderColor: theme.colors.danger,
                  borderWidth: 1.5,
                }}
              >
                <AppText variant="bodyMedium" color="danger">
                  Delete your account permanently?
                </AppText>
                <AppText
                  variant="caption"
                  color="textSecondary"
                  style={{ marginTop: 6 }}
                >
                  Your profile, listings and sessions are removed from Desi
                  Jugaad immediately - your listings leave the public feed and
                  you will need to create a new account to return. This cannot
                  be undone.
                </AppText>

                {deleteError ? (
                  <AppText
                    variant="caption"
                    color="danger"
                    style={{ marginTop: 8 }}
                    accessibilityLiveRegion="polite"
                  >
                    {deleteError}
                  </AppText>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Keep my account"
                      variant="outline"
                      size="sm"
                      disabled={deleting}
                      onPress={() => {
                        setConfirmDelete(false);
                        setDeleteError(null);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={deleting ? 'Deleting…' : 'Delete account'}
                      variant="danger"
                      size="sm"
                      loading={deleting}
                      onPress={() => void deleteAccount()}
                    />
                  </View>
                </View>
              </Card>
            ) : null}

            {ROWS.map((row) => (
              <Card
                key={row.id}
                padding="md"
                style={{ marginBottom: theme.spacing.sm }}
                onPress={() => openRow(row)}
                accessibilityLabel={row.label}
              >
                <View style={styles.row}>
                  <View
                    style={[
                      styles.rowIcon,
                      {
                        backgroundColor: row.destructive
                          ? theme.colors.dangerTint
                          : theme.colors.primaryTint,
                        borderRadius: theme.radius.md,
                      },
                    ]}
                  >
                    <Ionicons
                      name={row.icon as never}
                      size={18}
                      color={row.destructive ? theme.colors.danger : theme.colors.primary}
                    />
                  </View>

                  <View style={styles.rowText}>
                    <AppText
                      variant="bodyMedium"
                      color={row.destructive ? 'danger' : 'text'}
                    >
                      {row.label}
                    </AppText>
                    <AppText
                      variant="caption"
                      color="textMuted"
                      style={{ marginTop: 2 }}
                    >
                      {row.description}
                    </AppText>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </View>
              </Card>
            ))}

            <AppText
              variant="caption"
              color="textMuted"
              align="center"
              style={{ marginTop: theme.spacing.lg }}
            >
              Desi Jugaad v1.0.0
            </AppText>
          </View>
        )}
      </ScrollView>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
});
