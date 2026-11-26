/**
 * Input - the single text-field primitive (label + control + hint/error).
 *
 * Error text is wired through accessibilityLiveRegion so a validation failure
 * is announced, not just coloured red.
 */

import { forwardRef } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputInstance,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { AppText } from './app-text';
import { useTheme } from '@/theme/use-theme';

export interface InputProps extends TextInputProps {
  label?: string;
  /** Helper shown when there is no error. */
  hint?: string;
  /** Validation message. Presence switches the field to its error state. */
  error?: string;
  /** Marks the field as required in the UI (Prompt.md §12). */
  required?: boolean;
  /** Renders an optional tag instead of a required mark. */
  optional?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input = forwardRef<TextInputInstance, InputProps>(function Input(
  { label, hint, error, required, optional, containerStyle, style, multiline, ...rest },
  ref,
) {
  const theme = useTheme();
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="label" color="text">
            {label}
          </AppText>
          {required ? (
            <AppText variant="caption" color="danger" style={{ marginLeft: 4 }}>
              *
            </AppText>
          ) : null}
          {optional ? (
            <AppText variant="caption" color="textMuted" style={{ marginLeft: 6 }}>
              Optional
            </AppText>
          ) : null}
        </View>
      ) : null}

      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={label ?? rest.placeholder}
        accessibilityState={{ disabled: rest.editable === false }}
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surface,
            borderColor: hasError ? theme.colors.danger : theme.colors.border,
            borderWidth: hasError ? 1.5 : StyleSheet.hairlineWidth,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            minHeight: multiline ? 108 : theme.layout.controlHeight,
            paddingVertical: multiline ? theme.spacing.md : 0,
            paddingHorizontal: theme.spacing.lg,
          },
          rest.editable === false && styles.disabled,
          style,
        ]}
        {...rest}
      />

      {hasError ? (
        <AppText
          variant="caption"
          color="danger"
          style={{ marginTop: theme.spacing.xs }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  field: {
    width: '100%',
    fontSize: 15,
    lineHeight: 21,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default Input;
