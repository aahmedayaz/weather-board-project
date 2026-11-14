# Prompt log

IDE used: **Claude Code**. Every prompt submitted in this project is appended below verbatim by the `UserPromptSubmit` hook (`scripts/log-prompt.mjs`).

## Prompt 1 — ~2026-11-13T20:10Z (backfilled: submitted before the hook existed)

````text
I am building WeatherBoard, a Vite + React + TypeScript PWA weather dashboard.

Before writing any app code, create:
(1) CLAUDE.md with project rules: strict TypeScript with no any, feature-based folders (src/app, src/features/{search,weather,favorites,pwa,push,settings}, src/shared/{ui,hooks,lib,api}), Conventional Commits, branch names feat/<name> cut from dev, never commit secrets, validate every external input with Zod, every async UI needs loading, empty and error states with specific messages, no mocked data, accessible by default (keyboard, ARIA, 44px touch targets), rendering rules (derive state instead of storing it, memoize only with a measured reason, stable keys and callbacks, split components so state lives low, lazy-load non-critical UI), and a short definition of done (lint, typecheck, tests, build, e2e all pass).

(2) A UserPromptSubmit hook in .claude/settings.json that runs scripts/log-prompt.mjs to append each prompt verbatim to PROMPTS.md with an incrementing number and a timestamp; the script must print nothing to stdout, must never throw, and PROMPTS.md must start with a header saying the IDE used is Claude Code.

(3) Slash commands .claude/commands/start-feature.md (switch to dev, pull, create the branch passed as argument) and ship-feature.md (run npm run verify, push, open a PR into dev with gh pr create).

Show me the files, then verify the hook works with a test prompt.
````

## Prompt 2 — 2026-11-13T20:20:06.954Z

````text
Scaffold the project in the current folder with Vite react-ts using npm. Add Tailwind CSS (official Vite plugin), TanStack Query, Zod, react-hook-form with @hookform/resolvers, Vitest + React Testing Library + jsdom, Playwright (chromium only), @axe-core/playwright. 

Configure: TypeScript strict with noUncheckedIndexedAccess and a @/ path alias;
ESLint flat config with typescript-eslint, react-hooks, jsx-a11y and react-refresh; 
Prettier with the Tailwind class-sorting plugin; Husky with lint-staged (eslint --fix and prettier on staged files) as pre-commit, commitlint with Conventional Commits as commit-msg, and typecheck plus unit tests as pre-push. 

Add a Zod-validated env module. 
Add npm scripts: dev, build, preview, lint, typecheck, test, e2e, format, and verify (lint + typecheck + test + build + e2e). 

Add .env.example with variable names only, a sensible .gitignore, and engines for Node. 
Keep the app itself as an empty shell. Explain any choice that is not obvious.
````

## Prompt 3 — 2026-11-13T20:57:43.310Z

````text
Add GitHub Actions: 
.github/workflows/ci.yml triggered on pull requests and pushes to dev, prod and main, with npm ci, lint, typecheck, unit tests, build, Playwright e2e (cache browsers), and Lighthouse CI with assertions (performance, accessibility, best-practices, seo at least 0.9; pwa checks once the PWA exists). 

Add vercel.json with an SPA rewrite that excludes /api, long-lived immutable caching for hashed assets, and security headers: a strict Content-Security-Policy (no unsafe-inline scripts; allow self, the proxy, and the Cloudflare Worker URL via an env-driven placeholder), X-Content-Type-Options, Referrer-Policy, Permissions-Policy (allow notifications only for self), and frame-ancestors none. 

Explain every CSP directive in a comment in README notes I can copy later.

Then commit, open the PR to "main"
````

## Prompt 4 — 2026-11-13T22:00:42.896Z

````text
P1 - (feat/design-system)

Build the design system with the Linear (linear.app) /Mercury (mercury.com) direction: 

Tailwind theme tokens for the light and dark palettes I provided (CSS variables so theme switching never re-renders React), Inter Variable self-hosted, tabular numbers for data, and primitives in src/shared/ui: Button, IconButton, Input (with label, hint, inline error and aria-describedby), Card, Skeleton, Banner (info, warning, error with an action), Dialog (accessible modal with focus trap and Escape for confirmations), VisuallyHidden. 

All interactive elements at least 44x44 px on mobile, visible focus rings. 
Build the page shell: header, main grid that is one column at 375, two at 768, and a 12-column dashboard at 1280, with no horizontal scroll. 

Add component tests for the Input error states and the Dialog focus behaviour. 
Keep it lean: no animation libraries.
````

## Prompt 5 — 2026-11-13T22:38:35.082Z

````text
P2-(feat/search-autocomplete)

Implement requirement 01. 
Server: api/cities.ts Vercel function that validates the q parameter with Zod (2 to 60 characters, trimmed), calls GeoDB Cities through RapidAPI using server-only env vars, returns only the fields the UI needs (id, name, region, country, lat, lon), sets Cache-Control with s-maxage and stale-while-revalidate, and maps 429, 5xx and network failures to typed JSON errors. 

Client: a useDebouncedValue hook (150 ms), TanStack Query with the abort signal, staleTime, and placeholderData that keeps the previous results while typing, so the list never flashes empty. Build an accessible combobox (role combobox, listbox, aria-activedescendant, arrow keys, Enter, Escape, click outside) with visible states: idle hint, loading, results, no results (explain what to try), rate-limited (explain and auto-retry countdown), network failure (retry button). 

Validation with react-hook-form on blur: empty field shows an inline error. 

Memoize result rows with a stable callback so typing does not re-render every row; show me a Profiler check or a render-count test that proves it. Add unit tests for the hook and e2e tests with mocked network for each state.
````

## Prompt 6 — 2026-11-13T23:21:49.530Z

````text
P3-(feat/weather-display)

Implement requirement 02. 
Server: api/weather.ts that validates lat and lon with Zod, fetches current conditions and the 5-day/3-hour forecast from OpenWeatherMap in metric units, and on 429 or 5xx falls back to Open-Meteo, normalizing both into one Zod-validated WeatherBundle type (so the client never knows which source answered; include the source name for a small footer). Aggregate the 3-hour slots into five daily entries (min, max, dominant condition, precipitation chance) with a pure, unit-tested function. 

Client: TanStack Query keyed by lat/lon, staleTime 10 minutes, no retry on 4xx, retry with backoff on 5xx, refetchOnWindowFocus with a throttle so rapid tab switching cannot spam the API, and a manual refresh button throttled to once per 10 seconds with visible feedback. 

Build CurrentConditions and ForecastStrip with skeleton loading and specific error messages (offline, rate limited, city not found, server problem) each with a recovery action. 
Select derived data inside useQuery so components only re-render on what they use; React.memo only on ForecastDay after measuring. 

Remember the last viewed city (default Karachi) through a safe storage util: try/catch, Zod-parsed so tampered values are ignored. 

Add tests including the aggregation function and error states.

````

## Prompt 7 — 2026-11-14T01:00:30.563Z

````text
P4-(feat/favorites)

Implement requirement 04. 
A favourites store using useSyncExternalStore on top of a safe storage util (cross-tab sync through the storage event, Zod-validated reads), maximum 5 cities, duplicates prevented, clear message when the limit is reached. 
If localStorage is unavailable or throws, fall back to in-memory state and show a dismissible banner explaining favourites will not persist. 

Quick-access panel: a sidebar at 1280, horizontal chips at 375, each selectable by keyboard.

Removal opens the confirmation Dialog and returns focus to a sensible element afterwards. 

Prefetch a favourite's weather on hover or focus. Add unit tests for the store (limit, duplicates, corrupted JSON, storage disabled) and e2e for add, limit and confirm-remove.
````

## Prompt 8 — 2026-11-14T01:00:30.563Z

````text
P5-(feat/pwa-offline)

Implement requirement 05 with vite-plugin-pwa using the injectManifest strategy and a custom src/sw.ts (I need push in the same worker later). 

Manifest: name, short_name, 192 and 512 icons plus a maskable icon (generate them from one SVG with a script), theme_color matching the palette, background_color, display standalone, start_url and scope. 

Service worker: precache the app shell; NetworkFirst runtime caching for /api/weather in its own cache with an ExpirationPlugin of maxEntries 1 so only the last viewed city is kept; never cache /api/cities. 

Add an offline banner driven by useSyncExternalStore on the online/offline events, and make the UI render the cached last city when offline with a clear label saying how old the data is. 

Add a custom install button using beforeinstallprompt and an update-available toast. 

Test offline behaviour in Playwright with context.setOffline. 
Explain in the README notes why NetworkFirst and not StaleWhileRevalidate.
````

## Prompt 9 — 2026-11-14T01:00:30.563Z

````text
P6-(feat/push-notifications)

Implement requirement 06. First check current docs for Cloudflare Workers: the web-push npm package depends on Node APIs, so confirm whether it works under the nodejs_compat flag; if not, choose a WebCrypto-based Web Push library and tell me which and why. 

Create worker/ with its own package.json and wrangler.toml with dev and production environments: POST /subscribe and POST /unsubscribe (Zod-validated: subscription, local reminder time HH:mm in 5-minute steps, IANA timezone, city name and coordinates), a D1 table, a CORS allowlist from env, VAPID keys as wrangler secrets, and a Cron Trigger every 5 minutes that finds subscriptions whose local time is due and not yet sent today, fetches a short forecast from Open-Meteo, sends the push, and deletes subscriptions that return 404 or 410. 


Keep the push-send logic in a pure module that takes the sender and the store as parameters, so it can be unit-tested with a mocked sender and a mocked subscription store. 

Client: before the browser permission prompt, show an explainer dialog (what you get, what time, you can turn it off) with a reminder-time picker validated on blur; only after the user confirms call Notification.requestPermission and pushManager.subscribe. 

Detect missing support (service worker, PushManager, Notification) and show a clear fallback; handle denied permission with instructions to re-enable it, without breaking anything else. 

Add push and notificationclick handlers to src/sw.ts that open the app on the saved city. Playwright tests must mock permission and subscription flows. 
Add a note about iOS requiring the installed PWA.
````

## Prompt 10 — 2026-11-14T01:00:30.563Z

````text
P7-(feat/theme-units-icons)

Implement the bonus features. 
Theme: light, dark and system, defaulting to system with a listener for prefers-color-scheme changes, persisted, applied before first paint with a tiny same-origin script file (no inline script, so the CSP stays strict) to prevent a flash. 

Units: a Celsius/Fahrenheit toggle that also switches wind between km/h and mph, persisted, applied purely at render time from the metric data so toggling never refetches and never reloads the page; use a small context that only the components showing units subscribe to. 

Animated condition icons: lightweight inline SVG with CSS animations (sun rays rotating slowly, drifting clouds, falling rain, snowfall, fog), GPU-friendly transforms only, paused offscreen, and fully disabled under prefers-reduced-motion. 

Do not add Lottie; explain the bundle-size reason in a code comment. 
Add tests for conversions and e2e for persistence after reload.
````

## Prompt 11 — 2026-11-14T01:00:30.563Z

````text
P8-(chore/hardening)

Audit and improve quality. 
Performance: add a bundle visualizer, set a bundle budget (initial JS under 150 kB gzipped), lazy-load the push settings dialog and any non-critical panel, preconnect to the API origin, preload the main font file, and check Core Web Vitals through Lighthouse CI. 

Re-render audit: use the React Profiler on search typing, weather refresh, favourites toggle and theme switch, fix real problems only, and summarize before/after findings in a table I can paste into the README. 

Responsive: Playwright suite at 375, 768 and 1280 that asserts no horizontal scroll (scrollWidth not greater than clientWidth) and that every interactive element is at least 44x44 px at 375, plus axe accessibility scans on each state. 

Security: confirm no keys in the built bundle (grep the dist folder), no dangerouslySetInnerHTML, headers present on the deployed preview, run npm audit, and Zod-validate all API responses on the client. 

Report anything you could not fix.
````
