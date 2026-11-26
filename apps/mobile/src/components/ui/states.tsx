/**
 * ============================================================================
 * Shared screen states
 * ============================================================================
 *
 * Prompt.md §3 and §19 require consistent loading, empty and error states on
 * every screen. These three components are the approved way to render them so
 * the app never invents a one-off spinner or a dead-end empty page.
 *
 * Every empty/error state carries a real action - the brief forbids dead-end
 * screens - so callers must pass either an `action` or `onRetry`.
 */

import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { AppText } from './app-text';
import { Button } from './button';
import { useTheme } from '@/theme/use-theme';

/* ---------------------------------------------------------------------------
 * Loading
 * ------------------------------------------------------------------------ */

export function LoadingState({
  label = 'Loading…',
  compact = false,
}: {
  label?: string;
  /** Inline variant for use inside a card rather than a whole screen. */
  compact?: boolean;
}) {
  const theme = useTheme();

  if (compact) {
    return (
      <View style={styles.inline} accessibilityRole="progressbar">
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <AppText variant="caption" color="textMuted" style={{ marginLeft: theme.spacing.sm }}>
          {label}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <AppText variant="body" color="textMuted" style={{ marginTop: theme.spacing.md }}>
        {label}
      </AppText>
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Empty
 * ------------------------------------------------------------------------ */

export interface EmptyStateProps {
  title: string;
  /** One or two sentences explaining why it is empty and what to do. */
  message?: string;
  /** Leading glyph. Kept as text so no extra icon dependency is needed. */
  icon?: string;
  /** Primary action - required so the state is never a dead end. */
  action?: { label: string; onPress: () => void };
  /** Optional secondary action. */
  secondaryAction?: { label: string; onPress: () => void };
  compact?: boolean;
}

export function EmptyState({
  title,
  message,
  icon = '✦',
  action,
  secondaryAction,
  compact = false,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.center,
        compact && { paddingVertical: theme.spacing.xl },
      ]}
      accessibilityRole="text"
    >
      <View
        style={[
          styles.iconBubble,
          {
            backgroundColor: theme.colors.primaryTint,
            borderRadius: theme.radius.pill,
            marginBottom: theme.spacing.md,
          },
        ]}
      >
        <AppText variant="title" color="primary">
          {icon}
        </AppText>
      </View>

      <AppText variant="subheading" align="center">
        {title}
      </AppText>

      {message ? (
        <AppText
          variant="body"
          color="textSecondary"
          align="center"
          style={{ marginTop: theme.spacing.sm, maxWidth: 320 }}
        >
          {message}
        </AppText>
      ) : null}

      {action ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}

      {secondaryAction ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button label={secondaryAction.label} onPress={secondaryAction.onPress} variant="ghost" />
        </View>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Error
 * ------------------------------------------------------------------------ */

export interface ErrorStateProps {
  title?: string;
  message?: string;
  /** Retry handler - renders the primary action. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra escape hatch so the user is never stuck. */
  secondaryAction?: { label: string; onPress: () => void };
  compact?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  secondaryAction,
  compact = false,
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.center, compact && { paddingVertical: theme.spacing.xl }]}
      accessibilityRole="alert"
    >
      <View
        style={[
          styles.iconBubble,
          {
            backgroundColor: theme.colors.dangerTint,
            borderRadius: theme.radius.pill,
            marginBottom: theme.spacing.md,
          },
        ]}
      >
        <AppText variant="title" color="danger">
          !
        </AppText>
      </View>

      <AppText variant="subheading" align="center">
        {title}
      </AppText>

      <AppText
        variant="body"
        color="textSecondary"
        align="center"
        style={{ marginTop: theme.spacing.sm, maxWidth: 320 }}
      >
        {message}
      </AppText>

      {onRetry ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button label={retryLabel} onPress={onRetry} />
        </View>
      ) : null}

      {secondaryAction ? (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
            variant="ghost"
          />
        </View>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Skeleton - shimmer-free placeholder rows for list loading
 * ------------------------------------------------------------------------ */

export function SkeletonBlock({
  width,
  height = 16,
  radius,
  style,
}: {
  width: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
        },
        style,
      ]}
    />
  );
}

/** Standard skeleton for a card-shaped list item. */
export function SkeletonCard({ count = 3 }: { count?: number }) {
  const theme = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.skeletonCard,
            {
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
              padding: theme.spacing.lg,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          <SkeletonBlock width="70%" height={18} />
          <SkeletonBlock width="45%" height={14} style={{ marginTop: theme.spacing.sm }} />
          <SkeletonBlock width="30%" height={14} style={{ marginTop: theme.spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * ScreenState - pick the right state from a standard query result
 * ------------------------------------------------------------------------ */

export interface ScreenStateProps {
  loading: boolean;
  error: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  emptyProps?: EmptyStateProps;
  children: React.ReactNode;
  /** Rendered instead of the default skeleton while loading. */
  loadingFallback?: React.ReactNode;
}

/**
 * Renders the correct state for a data-driven section in one place, so no
 * screen can forget its error or empty branch.
 */
export function ScreenState({
  loading,
  error,
  isEmpty = false,
  onRetry,
  emptyProps,
  children,
  loadingFallback,
}: ScreenStateProps) {
  if (loading) return <>{loadingFallback ?? <LoadingState />}</>;

  if (error) {
    return (
      <ErrorState
        onRetry={onRetry}
        secondaryAction={
          emptyProps?.action
            ? { label: emptyProps.action.label, onPress: emptyProps.action.onPress }
            : undefined
        }
      />
    );
  }

  if (isEmpty && emptyProps) return <EmptyState {...emptyProps} />;

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconBubble: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonCard: {
    minHeight: 96,
  },
});
