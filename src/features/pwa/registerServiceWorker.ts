import { registerSW } from 'virtual:pwa-register';

import { notifyUpdateAvailable } from './pwaStore';

/**
 * Registers /sw.js (production builds only — the plugin's dev mode is off).
 * When a new version is waiting, the update toast offers to reload into it; accepting sends
 * SKIP_WAITING to the worker and reloads once it takes control.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      notifyUpdateAvailable(() => updateServiceWorker(true));
    },
  });
}
