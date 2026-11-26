/**
 * SignInRequired - shown by screens that need a session instead of the old
 * dead-end "401 -> Try again" error that could never succeed.
 *
 * Renders the screen heading plus a friendly prompt with a real sign-in
 * action (and an escape hatch to Home), so anonymous users are never stuck.
 */

import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/states';
import { useTheme } from '@/theme/use-theme';

export interface SignInRequiredProps {
  /** Screen heading shown above the prompt, e.g. "Messages". */
  heading: string;
  /** Prompt title, e.g. "Sign in to see your messages". */
  title: string;
  message?: string;
}

export function SignInRequired({
  heading,
  title,
  message,
}: SignInRequiredProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top']}
    >
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <AppText variant="heading">{heading}</AppText>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon="→"
          title={title}
          message={
            message ?? 'Sign in to continue - your account keeps this private.'
          }
          action={{
            label: 'Sign in',
            onPress: () => router.push('/auth-signin'),
          }}
          secondaryAction={{
            label: 'Go to Home',
            onPress: () => router.replace('/(tabs)'),
          }}
        />
      </View>
    </SafeAreaView>
  );
}

export default SignInRequired;
