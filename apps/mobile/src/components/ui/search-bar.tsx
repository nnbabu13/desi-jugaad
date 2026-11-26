/**
 * SearchBar - the prominent search field used on Home (Prompt.md §4) and
 * Explore (§5).
 *
 * `variant="button"` renders a tappable field that opens search (Home), while
 * `variant="input"` is a live controlled field (Explore). Both share one look
 * so search feels like the same control in both places.
 */

import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import {
  Pressable,
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

export interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  /** `button` = tap to open search; `input` = live text field. */
  variant?: 'button' | 'input';
  placeholder?: string;
  /** Leading control for a live field (e.g. country selector). */
  leading?: React.ReactNode;
  /** Trailing control, e.g. a filter button. */
  trailing?: React.ReactNode;
  /** For `button` variant - opens the search screen. */
  onPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SearchBar = forwardRef<TextInputInstance, SearchBarProps>(function SearchBar(
  {
    variant = 'input',
    placeholder = 'What are you looking for?',
    leading,
    trailing,
    onPress,
    containerStyle,
    value,
    onChangeText,
    ...rest
  },
  ref,
) {
  const theme = useTheme();

  const shell: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  };

  const content = (
    <>
      <Ionicons name="search" size={18} color={theme.colors.textMuted} />

      {variant === 'button' ? (
        <AppText
          variant="body"
          color="textMuted"
          style={styles.text}
          numberOfLines={1}
        >
          {placeholder}
        </AppText>
      ) : (
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text }]}
          returnKeyType="search"
          accessibilityLabel={placeholder}
          {...rest}
        />
      )}

      {trailing}
    </>
  );

  if (variant === 'button') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        style={({ pressed }) => [
          styles.shell,
          shell,
          { height: theme.layout.controlHeight, opacity: pressed ? 0.7 : 1 },
          containerStyle,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        shell,
        { minHeight: theme.layout.controlHeight },
        containerStyle,
      ]}
    >
      {leading}
      {content}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    width: '100%',
  },
  text: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: 12,
  },
});

export default SearchBar;
