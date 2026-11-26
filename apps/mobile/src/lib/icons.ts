/**
 * Shared icon-name type.
 *
 * `@expo/vector-icons` exports its glyph maps as component props, so the
 * allowed name union is derived once here instead of being re-declared (and
 * drift-prone) in every file that passes an icon name around.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default IoniconName;
