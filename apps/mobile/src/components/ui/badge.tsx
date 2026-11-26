/**
 * ============================================================================
 * Badge / Chip - trust signals
 * ============================================================================
 *
 * POLICY (Prompt.md §14, §19): "Never display a verified badge unless the
 * relevant verification has actually been completed" and seeded content must
 * show a "Sample" chip and must never carry a verified badge.
 *
 * This module enforces both rules structurally rather than by convention:
 *
 *   1. `<VerifiedBadge>` only accepts `verificationStatus`, never a bare
 *      `verified: boolean`. It renders nothing unless the status is the
 *      literal 'VERIFIED' AND the record is not demo content.
 *   2. `<SampleBadge>` is rendered automatically by `<TrustRow>` whenever a
 *      record is demo content, so a sample listing cannot be presented as
 *      genuine.
 *   3. `<TrustRow>` refuses to render both badges for the same record - a
 *      sample record cannot be verified.
 *
 * Do not bypass these components with a hand-rolled checkmark.
 */

import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useTheme } from '@/theme/use-theme';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export type VerificationStatus =
  | 'VERIFIED'
  | 'PENDING'
  | 'FAILED'
  | 'EXPIRED'
  | 'NONE';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Leading glyph. Prefer text-free icons from the shared icon set. */
  icon?: string;
  /** Compact variant for dense cards. */
  size?: 'sm' | 'md';
}

/* ---------------------------------------------------------------------------
 * Badge
 * ------------------------------------------------------------------------ */

export function Badge({ label, tone = 'neutral', icon, size = 'md' }: BadgeProps) {
  const theme = useTheme();

  const toneStyles: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surfaceSunken, fg: theme.colors.textSecondary },
    primary: { bg: theme.colors.primaryTint, fg: theme.colors.primary },
    secondary: { bg: theme.colors.secondaryTint, fg: theme.colors.secondary },
    accent: { bg: theme.colors.accentTint, fg: theme.palette.orangeDark },
    success: { bg: theme.colors.successTint, fg: theme.colors.success },
    warning: { bg: theme.colors.warningTint, fg: theme.colors.warning },
    danger: { bg: theme.colors.dangerTint, fg: theme.colors.danger },
  };

  const { bg, fg } = toneStyles[tone];
  const compact = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingVertical: compact ? 2 : 3,
          paddingHorizontal: compact ? 6 : 8,
          borderRadius: theme.radius.sm,
        },
      ]}
    >
      {icon ? (
        <AppText variant="caption" color={tone === 'accent' ? 'text' : 'text'} style={{ marginRight: 4 }}>
          {icon}
        </AppText>
      ) : null}
      <AppText
        variant="caption"
        style={[styles.badgeLabel, { color: fg }]}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * SampleBadge - required for all seeded/demo content
 * ------------------------------------------------------------------------ */

export function SampleBadge({ size = 'md' }: { size?: BadgeTone extends never ? never : 'sm' | 'md' }) {
  return <Badge label="Sample" tone="neutral" icon="◆" size={size} />;
}

/* ---------------------------------------------------------------------------
 * VerifiedBadge - renders ONLY on genuinely completed verification
 * ------------------------------------------------------------------------ */

export interface VerifiedBadgeProps {
  /**
   * The real verification status from the API. A boolean is deliberately NOT
   * accepted: passing `true` by mistake would fabricate a trust signal.
   */
  verificationStatus: VerificationStatus;
  /**
   * Demo/sample records are never verified, regardless of status. Set this
   * from the record's `demoData` flag.
   */
  isDemo?: boolean;
  /** What was verified, e.g. 'Email', 'ID'. */
  scope?: string;
  size?: 'sm' | 'md';
}

export function VerifiedBadge({
  verificationStatus,
  isDemo = false,
  scope,
  size = 'md',
}: VerifiedBadgeProps) {
  // Structural guard: sample content can never show as verified.
  if (isDemo) return null;
  if (verificationStatus !== 'VERIFIED') return null;

  return (
    <Badge
      label={scope ? `Verified ${scope}` : 'Verified'}
      tone="secondary"
      icon="✓"
      size={size}
    />
  );
}

/* ---------------------------------------------------------------------------
 * TrustRow - the standard way to render a record's trust signals
 * ------------------------------------------------------------------------ */

export interface TrustRowProps {
  /** True when the record is seeded/sample content. */
  isDemo: boolean;
  /** Real verification status for the record, or null if not applicable. */
  verificationStatus?: VerificationStatus | null;
  /** Optional extra badges, e.g. 'Featured'. */
  children?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: React.ComponentProps<typeof View>['style'];
}

/**
 * Renders the correct trust signals for a record and guarantees the two
 * policy rules above. Prefer this over composing badges by hand.
 */
export function TrustRow({
  isDemo,
  verificationStatus = null,
  children,
  size = 'md',
  style,
}: TrustRowProps) {
  const theme = useTheme();

  // A sample record is never verified - drop the status entirely.
  const effectiveStatus: VerificationStatus = isDemo
    ? 'NONE'
    : (verificationStatus ?? 'NONE');

  const showVerified = effectiveStatus === 'VERIFIED';
  const showSample = isDemo;

  if (!showVerified && !showSample && !children) return null;

  return (
    <View style={[styles.trustRow, { gap: theme.spacing.xs }, style]}>
      {showSample ? <SampleBadge size={size} /> : null}
      {showVerified ? (
        <VerifiedBadge verificationStatus="VERIFIED" size={size} />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  badgeLabel: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});

export default Badge;
