/**
 * Navigation helpers shared by pushed screens.
 *
 * `router.back()` dispatches a GO_BACK action that throws an unhandled error
 * when the screen is the first in the stack (deep links, restored tabs).
 * `goBackSafe` falls back to a real destination instead of a red toast.
 */

import { router, type Href } from 'expo-router';

export function goBackSafe(fallback: Href = '/(tabs)'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

export default goBackSafe;
