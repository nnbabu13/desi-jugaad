/**
 * AppText - the only text primitive. Applies a named type style plus the
 * theme's colour roles, so typography and colour stay consistent everywhere.
 */

import { Text, TextProps, StyleProp, TextStyle } from 'react-native';

import { useTheme, TypeStyle } from '@/theme/use-theme';
import { ColorRole } from '@/theme/tokens';

export interface AppTextProps extends TextProps {
  /** Named type style from the design system. Defaults to `body`. */
  variant?: TypeStyle;
  /** Semantic colour role. Defaults to `text`. */
  color?: ColorRole;
  /** Align convenience - keeps call sites free of raw style objects. */
  align?: 'left' | 'center' | 'right';
  /** Extra style applied after the type style (spacing tweaks only). */
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function AppText({
  variant = 'body',
  color = 'text',
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  const theme = useTheme();

  return (
    <Text
      {...rest}
      style={[
        theme.type[variant],
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export default AppText;
