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
import { z } from 'zod';

// The worker is served with the same strict CSP: skip Zod's eval probe (see zodConfig.ts).
z.config({ jitless: true });

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

// ---- Push: daily forecast reminders (sent by worker/) ----------------------------------

const ReminderPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(300),
  // Same-origin path only: a payload must never send the user to another site.
  url: z.string().regex(/^\/(?!\/)/),
});
type ReminderPayload = z.infer<typeof ReminderPayloadSchema>;

const FALLBACK_PAYLOAD: ReminderPayload = {
  title: 'WeatherBoard',
  body: 'Today’s forecast is ready.',
  url: '/',
};

function readPayload(event: PushEvent): ReminderPayload {
  try {
    const parsed = ReminderPayloadSchema.safeParse(event.data?.json());
    return parsed.success ? parsed.data : FALLBACK_PAYLOAD;
  } catch {
    return FALLBACK_PAYLOAD; // not JSON
  }
}

self.addEventListener('push', (event: PushEvent) => {
  const payload = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'daily-forecast', // a new reminder replaces yesterday's
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const data: unknown = event.notification.data;
  const path =
    typeof data === 'object' && data !== null && 'url' in data && typeof data.url === 'string'
      ? data.url
      : '/';
  const target = new URL(path, self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    (async () => {
      // Reuse an open WeatherBoard tab (navigated to the saved city) before opening a new one.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target.href);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
