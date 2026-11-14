/// <reference lib="webworker" />
/**
 * WeatherBoard service worker (vite-plugin-pwa, injectManifest strategy).
 * Hand-written rather than generated so push handlers can live in the same worker later.
 *
 * Caching policy
 * - App shell: precached (the build injects the file list into `self.__WB_MANIFEST`).
 * - Navigations: always the precached index.html (SPA), except /api/*.
 * - /api/weather: NetworkFirst into its own cache, maxEntries 1 → only the last viewed city
 *   is kept for offline use. (README → "Why NetworkFirst" explains the choice.)
 * - /api/cities: never cached (NetworkOnly) — search results are useless offline and
 *   would only grow the cache.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

const WEATHER_CACHE = 'weather-last-city';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }),
);

registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname === '/api/weather',
  new NetworkFirst({
    cacheName: WEATHER_CACHE,
    networkTimeoutSeconds: 6,
    plugins: [
      // Only successful bundles are worth keeping; never cache an error body.
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 1 }),
    ],
  }),
);

registerRoute(({ url }) => url.pathname.startsWith('/api/cities'), new NetworkOnly());

// The page asks a waiting worker to take over when the user accepts the update toast.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data: unknown = event.data;
  if (typeof data === 'object' && data !== null && 'type' in data && data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
