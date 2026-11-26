/**=============================================================================
 * Sign in / Create account screen (Prompt.md §11).
 *
 * Stage 2 builds a fully working credential flow against the live API so the
 * app never shows a mock login page. Register, sign-in, session restore and
 * token refresh all run against the real NestJS backend; Stage 3 extends this
 * with location selection and verification journeys.
 *
 * No dead ends: every control either submits, switches mode, or navigates to
 * real content. Profile screen follows sign-in.
 *=============================================================================*/

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/use-theme';
import { router } from 'expo-router';

type Mode = 'signin' | 'signup';

function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
  return null;
}

// Layout-only styles; every colour comes from the theme so dark mode works.
const baseStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modeTabs: {
    display: 'flex',
    gap: 4,
    padding: 12,
    borderRadius: 12,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  formCard: {
    marginTop: 24,
    marginBottom: 24,
    padding: 24,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  formGroup: {
    gap: 16,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function AuthScreen() {
  const theme = useTheme();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setFormError(null);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};

    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;

    if (!password) {
      next.password = 'Password is required';
    } else if (password.length < 8) {
      next.password = 'Use at least 8 characters';
    }

    if (isSignup) {
      if (!fullName.trim()) next.fullName = 'Enter your name';
      if (!acceptTerms) next.acceptTerms = 'Please accept the terms to continue';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (submitting) return;
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isSignup) {
        // The auth store adopts the session (access token + /auth/me), so the
        // profile tab has real user data the moment we navigate.
        await register({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          acceptTerms: true,
        });
      } else {
        await login({ email: email.trim(), password });
      }
      router.replace('/(tabs)');
    } catch (err) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : 'Something went wrong. Please try again.';
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView
      style={[baseStyles.root, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={baseStyles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={[baseStyles.header, { borderBottomColor: theme.colors.border }]}
        >
          <AppText variant="bodyMedium">
            {isSignup ? 'Create account' : 'Sign in'}
          </AppText>
        </View>

        {/* Mode tabs */}
        <View
          style={[baseStyles.modeTabs, { backgroundColor: theme.colors.surfaceSunken }]}
        >
          {['signin', 'signup'].map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => switchMode(m as Mode)}
                style={[
                  baseStyles.modeTab,
                  {
                    backgroundColor: active
                      ? theme.colors.surface
                      : 'transparent',
                    borderWidth: active ? StyleSheet.hairlineWidth : 0,
                    borderColor: active ? theme.colors.border : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m === 'signin' ? 'Sign in' : 'Create account'}
              >
                <AppText
                  variant={active ? 'bodyMedium' : 'body'}
                  color={active ? 'primary' : 'textMuted'}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Form */}
        <View
          style={[
            baseStyles.formCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={baseStyles.formGroup}>
            {isSignup ? (
              <Input
                label="Full name"
                required
                value={fullName}
                onChangeText={setFullName}
                placeholder="Aarav Sharma"
                error={errors.fullName}
                autoCapitalize="words"
                textContentType="name"
              />
            ) : null}

            <Input
              label="Email"
              required
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />

            <Input
              label="Password"
              required
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              hint={isSignup ? 'Use at least 8 characters.' : undefined}
              error={errors.password}
              secureTextEntry
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              textContentType={isSignup ? 'newPassword' : 'password'}
            />

            {isSignup ? (
              <View>
                <Pressable
                  onPress={() => setAcceptTerms((prev) => !prev)}
                  style={[
                    baseStyles.termsCheckbox,
                    {
                      borderColor: errors.acceptTerms
                        ? theme.colors.danger
                        : theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptTerms }}
                  accessibilityLabel="I accept the terms and conditions"
                >
                  <View
                    style={[
                      baseStyles.checkbox,
                      {
                        borderColor: acceptTerms
                          ? theme.colors.primary
                          : theme.colors.textMuted,
                        backgroundColor: acceptTerms
                          ? theme.colors.primary
                          : 'transparent',
                      },
                    ]}
                  >
                    {acceptTerms ? (
                      <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <AppText
                    variant="caption"
                    color="textSecondary"
                    style={{ flex: 1 }}
                  >
                    I accept the Terms and Conditions and the Privacy Policy.
                  </AppText>
                </Pressable>
                {errors.acceptTerms ? (
                  <AppText
                    variant="caption"
                    color="danger"
                    style={{ marginTop: 6 }}
                    accessibilityLiveRegion="polite"
                  >
                    {errors.acceptTerms}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            {formError ? (
              <View
                style={[
                  baseStyles.errorBox,
                  { backgroundColor: theme.colors.dangerTint },
                ]}
              >
                <AppText variant="caption" color="danger">{formError}</AppText>
              </View>
            ) : null}

            <Button
              fullWidth
              loading={submitting}
              onPress={submit}
              testID="auth-submit"
              label={isSignup ? 'Create account' : 'Sign in'}
            />

            <View style={baseStyles.switchPrompt}>
              <AppText variant="body" color="textMuted">
                {isSignup ? 'Already have an account?' : 'New to Desi Jugaad?'}
              </AppText>
              <Pressable
                onPress={() => switchMode(isSignup ? 'signin' : 'signup')}
                accessibilityRole="button"
                accessibilityLabel={isSignup ? 'Sign in instead' : 'Create an account'}
              >
                <AppText variant="bodyMedium" color="primary">
                  {isSignup ? 'Sign in' : 'Create one'}
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}