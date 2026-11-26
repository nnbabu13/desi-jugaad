/**
 * Root layout.
 *
 * Wraps the app in the providers every screen relies on, in the order they
 * depend on each other:
 *
 *   SafeAreaProvider   -> insets for headers and the tab bar
 *   ThemeProvider      -> React Navigation colours matching our tokens
 *   AuthProvider       -> signed-in user (needs the API client)
 *   LocationProvider   -> selected country/city (needs the auth user)
 *
 * The navigator is a Stack so routes outside the tab group (notably the
 * Post bottom sheet) can be presented over the tabs.
 */

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
// The splash lives under the safe-area until JS mounts.
import * as SplashScreen from 'expo-splash-screen';
// Colours so StatusBar reads from our system tokens.
import { useColorScheme } from 'react-native';
// Safe-area handling (for the tab bottom inset).
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/stores/auth';
import { LocationProvider } from '@/stores/location';
import { colors, palette } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash already hidden - nothing to do.
});

function useNavigationTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = colors[scheme];

  return {
    scheme,
    navTheme: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
        primary: c.primary,
        background: c.background,
        card: c.surface,
        text: c.text,
        border: c.border,
        notification: c.accent,
      },
    },
  };
}

export default function RootLayout() {
  const { scheme, navTheme } = useNavigationTheme();

  // Hide the splash once the JS bundle is ready to render.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <AuthProvider>
          <LocationProvider>
            <StatusBar
              style="auto"
            />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: scheme === 'light' ? colors.light.background : colors.dark.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              {/* Presented over the tabs as a sheet rather than a pushed page. */}
              <Stack.Screen
                name="post"
                options={{
                  presentation: 'transparentModal',
                  animation: 'fade',
                  gestureEnabled: true,
                }}
              />
            </Stack>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Re-exported so screens can reference brand colours without deep imports. */
export { palette };