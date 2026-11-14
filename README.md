# WeatherBoard

A Vite + React + TypeScript PWA weather dashboard. Project rules live in [CLAUDE.md](CLAUDE.md).

## Getting started

```bash
nvm use            # Node 24 (see .nvmrc; engines are enforced)
npm ci
cp .env.example .env.local   # fill in the values
npm run dev
```

## Scripts

| Script              | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `dev`               | Vite dev server                                                  |
| `build` / `preview` | Production build / serve it on :4173                             |
| `lint`              | ESLint, zero warnings allowed                                    |
| `typecheck`         | `tsc -b` across all project references                           |
| `test`              | Vitest unit/component tests                                      |
| `e2e`               | Playwright (Chromium) against the production build — build first |
| `lhci`              | Lighthouse CI against `dist/` — build first                      |
| `format`            | Prettier (with Tailwind class sorting)                           |
| `verify`            | lint → typecheck → test → build → e2e (the definition of done)   |
| `vercel:config`     | Fill the CSP placeholders in `vercel.json` (see below)           |

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `dev`, `prod` and `main`:
`npm ci` → lint → typecheck → unit tests → build → Playwright e2e (browser binaries cached per
Playwright version) → Lighthouse CI. Lighthouse asserts a score of at least 0.9 for performance,
accessibility, best practices and SEO. Reports are uploaded as workflow artifacts.

Lighthouse 12+ no longer has a PWA category, so PWA behaviour is covered by Playwright instead
(`e2e/pwa.spec.ts`): manifest and icons, service-worker control, offline shell and offline
weather via `context.setOffline`, cache contents, and the install button.

## Daily reminders (Web Push)

A Cloudflare Worker in [`worker/`](worker) stores push subscriptions in D1 and, from a Cron
Trigger every 5 minutes, sends each subscriber a short forecast at their chosen local time.

### Library choice: `web-push` on Workers

The official [`web-push`](https://github.com/web-push-libs/web-push) package is written for
Node (`node:crypto` ECDH/AES-GCM/ES256 and `node:https`). It **does work** on Cloudflare
Workers with the `nodejs_compat` flag — verified empirically in `workerd` (Wrangler's local
runtime, the same engine as production): VAPID key generation, aes128gcm payload encryption,
ES256 signing and an HTTPS send all succeed. Cloudflare's docs list `node:crypto` as fully
supported (except DSA/DH key pairs and ed448/x448) and enable the `node:https` client by
default for compatibility dates from 2025-08-15. `web-push` 4.x is ESM-only, so it is imported
as `import * as webpush from 'web-push'`. If bundle size ever matters more (~170 KB gzipped
worker today), a WebCrypto-only library such as `@pushforge/builder` is the drop-in fallback;
only `worker/src/sender.ts` would change.

### How it works

- `POST /subscribe` / `POST /unsubscribe` — Zod-validated (subscription, `HH:mm` in 5-minute
  steps, IANA time zone, city name + coordinates), CORS restricted to `ALLOWED_ORIGINS`.
- Cron (`*/5 * * * *`): per time zone, finds subscriptions due in the last hour that weren't
  sent today, fetches one Open-Meteo forecast per place, sends, and **deletes subscriptions that
  return 404 or 410**. Transient failures are retried on the next run; a reminder is never more
  than an hour late (no "morning" reminder in the evening).
- `worker/src/reminders.ts` is pure: the store, sender, forecast source and clock are
  parameters, so it is unit-tested with fakes.
- In the app, an explainer dialog (what you get, when, how to turn it off, reminder time
  validated on blur) comes **before** the browser's permission prompt; only "Turn on reminders"
  calls `Notification.requestPermission()` and `pushManager.subscribe()`. Missing support and a
  denied permission get their own explanations; nothing else in the app depends on push.
- The service worker's `push` handler validates the payload; `notificationclick` focuses or
  opens WeatherBoard on the saved city (`/?name=…&lat=…&lon=…`, validated, then cleaned up).

### iOS

Web Push on iPhone and iPad (iOS/iPadOS 16.4+) works **only in the installed PWA**: open the
site in Safari → Share → “Add to Home Screen”, then open WeatherBoard from the Home Screen and
turn reminders on there. In a Safari tab the reminder card explains this instead of offering a
button.

### Setup

```bash
cd worker && npm ci
npx web-push generate-vapid-keys                       # once
npx wrangler d1 create weatherboard-push-dev           # put the id into wrangler.toml
npm run db:migrate:dev
npx wrangler secret put VAPID_PUBLIC_KEY  --env dev
npx wrangler secret put VAPID_PRIVATE_KEY --env dev
npm run deploy:dev
```

Then set `VITE_PUSH_WORKER_URL` (the worker's origin) and `VITE_VAPID_PUBLIC_KEY` for the web
app, and pass the same origin as `WORKER_URL` to `npm run vercel:config` so the CSP allows it.
Repeat with `--env production` / `npm run deploy:production` for production.

## PWA and offline

- `vite-plugin-pwa` with the **injectManifest** strategy: `src/sw.ts` is hand-written (push
  handlers will live in the same worker), the plugin compiles it and injects the precache list.
- **Precache:** the app shell (JS, CSS, HTML, icons, Latin Inter subsets).
- **`/api/weather`:** `NetworkFirst` into its own cache `weather-last-city` with
  `ExpirationPlugin({ maxEntries: 1 })` — only the last viewed city is kept.
- **`/api/cities`:** never cached (`NetworkOnly`).
- Icons are generated from `public/icon.svg` with `npm run icons` (192, 512, maskable 512,
  Apple touch icon).
- Offline, the UI shows a page banner, renders the cached last city with “Offline — saved data.
  This weather was observed 2 hours ago”, and city search says it needs a connection.
- Playwright blocks service workers by default (they would bypass `page.route` mocks); the PWA
  spec opts back in and mocks on the browser context, which also sees worker requests.

### Why NetworkFirst and not StaleWhileRevalidate for weather

- **Freshness is the product.** StaleWhileRevalidate always answers from the cache first and
  updates it in the background, so an online user would see the _previous_ response — possibly
  hours old — and only get today's weather on the _next_ request. NetworkFirst gives online
  users live data every time and uses the cache only when the network fails or times out (6 s).
- **The cache is a fallback, not a speed-up.** In-memory caching already exists in TanStack
  Query (10-minute `staleTime`) and at the edge (`s-maxage=600`); a second "serve stale first"
  layer would only stack staleness on top.
- **Honest offline UI.** With NetworkFirst, a cached response is only ever shown when the
  device is offline (or the API is down) — exactly when the UI labels it with its age. With
  StaleWhileRevalidate, stale data would appear silently while online, unlabelled.
- **`maxEntries: 1` fits NetworkFirst.** The single entry is always the last successful live
  response for the last viewed city — the best possible offline answer.

## Deployment notes (Vercel)

### Rewrites and caching

- Every path except `/api/*` is rewritten to `/index.html`, so client-side routes work on reload.
  Real files (e.g. `/assets/*`, `/favicon.svg`) are served before rewrites apply.
- `/assets/*` gets `Cache-Control: public, max-age=31536000, immutable`. Vite puts a content
  hash in every filename there, so a changed file always has a new URL. `index.html` keeps
  Vercel's default (`max-age=0, must-revalidate`), so new deploys are picked up immediately.

### CSP placeholders

`vercel.json` is static: Vercel does not substitute environment variables into it. The
`connect-src` directive therefore contains two placeholders, `__PROXY_ORIGIN__` and
`__WORKER_ORIGIN__`, which the deploy job fills in before building:

```bash
PROXY_URL=https://<proxy-host> WORKER_URL=https://<worker>.workers.dev npm run vercel:config -- --write
```

Both values are Zod-validated (https only, reduced to their origin). `PROXY_URL` is optional —
leave it unset when the proxy is this app's own `/api`, which `'self'` already covers. If the
placeholders are deployed unrendered, browsers ignore them as invalid sources, so requests to the
worker are blocked (fails closed, never open). If config ever needs to be computed at deploy time
by Vercel itself, migrate to `vercel.ts`, which runs at build time and can read env vars.

### Content-Security-Policy, directive by directive

```text
# Fallback for every fetch directive not listed below: only this origin.
default-src 'self';

# JavaScript only from our own origin. No 'unsafe-inline', no 'unsafe-eval', no CDNs:
# an injected <script> or inline event handler will not run. Vite emits external bundles only.
script-src 'self';

# Stylesheets only from our own origin (Tailwind compiles to a file in /assets).
# React's style={...} prop is applied via CSSOM and is not affected.
style-src 'self';

# Images from our origin plus data: URIs (small inlined icons/SVGs).
# Add the weather-icon host here if icons are loaded from the API provider.
img-src 'self' data:;

# Web fonts only from our origin (self-host fonts; no Google Fonts CDN).
font-src 'self';

# fetch/XHR/WebSocket/EventSource targets: our origin (incl. /api), the weather proxy,
# and the Cloudflare Worker. Filled from env by `npm run vercel:config`.
connect-src 'self' __PROXY_ORIGIN__ __WORKER_ORIGIN__;

# The web app manifest must come from our origin.
manifest-src 'self';

# Service worker (and any web workers) only from our origin.
worker-src 'self';

# No <object>, <embed> or <applet> — plugin content is a classic XSS vector.
object-src 'none';

# Blocks injected <base href> tags from redirecting relative URLs to another host.
base-uri 'self';

# Forms may only submit to our origin (stops injected forms from posting data elsewhere).
form-action 'self';

# Nobody may frame this app (clickjacking protection). Supersedes X-Frame-Options,
# which is still sent as DENY for older browsers.
frame-ancestors 'none';

# Rewrites any accidental http:// subresource URL to https:// instead of loading it insecurely.
upgrade-insecure-requests
```

### Other security headers

- `X-Content-Type-Options: nosniff` — the browser must trust the declared MIME type, so a
  file served as text cannot be executed as a script.
- `Referrer-Policy: strict-origin-when-cross-origin` — full URL to our own origin, only the
  origin to other https sites, nothing on https → http.
- `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=()` —
  geolocation only for our own pages (for "use my location"); the rest is disabled.
  Notifications are **not** in this list on purpose: there is no `notifications` feature in the
  Permissions-Policy spec, and Chrome logs an "Unrecognized feature" console error for it
  (which would also cost Lighthouse best-practices points). Notification permission is gated by
  `Notification.requestPermission()` on our own origin, and `frame-ancestors 'none'` already
  prevents any third-party page from embedding the app to prompt for it.
- `X-Frame-Options: DENY` — legacy twin of `frame-ancestors 'none'`.
- HSTS is added by Vercel automatically for its domains and custom domains.
