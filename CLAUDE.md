# WeatherBoard — project rules

WeatherBoard is a Vite + React + TypeScript PWA weather dashboard. These rules are binding for every change.

## TypeScript

- `strict: true` (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Never use `any` — explicit or implicit. Use `unknown` and narrow it.
- No `as` casts to silence the compiler, no `@ts-ignore`. `@ts-expect-error` only with a comment explaining why.
- Types for external data are inferred from Zod schemas (`z.infer<typeof Schema>`), never hand-written alongside them.

## Folder structure (feature-based)

```
src/
  app/                 # entry, providers, router, app shell, global styles
  features/
    search/            # city/location search
    weather/           # current conditions + forecast
    favorites/         # saved locations
    pwa/               # service worker registration, install prompt, offline
    push/              # push notification subscription
    settings/          # units, theme, preferences
  shared/
    ui/                # presentational, reusable components
    hooks/             # generic hooks
    lib/               # pure utilities
    api/               # HTTP client, Zod schemas for external responses
```

- A feature owns its components, hooks, schemas and tests. Features import from `shared/`, never from each other's internals; cross-feature use goes through the feature's `index.ts`.
- `shared/` never imports from `features/` or `app/`.
- Tests live next to the code they test (`*.test.ts(x)`); e2e tests live in `e2e/`.

## Git

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`, `build:`, `ci:` — optional scope (`feat(search): …`), imperative mood.
- Branches are named `feat/<name>` (kebab-case) and cut from `dev`. PRs target `dev`. Never commit directly to `dev` or `main`.
- Use `/start-feature <name>` and `/ship-feature`.
- Never commit secrets: API keys, VAPID private keys and tokens go in `.env.local` (git-ignored). Only `VITE_`-prefixed, non-secret values may reach the client bundle. Commit `.env.example` with placeholder values only.

## Data and validation

- Validate every external input with Zod at the boundary: API responses, `localStorage`/IndexedDB reads, URL/query params, push payloads, `postMessage` data, form input. Use `safeParse` and turn failures into typed errors — never let unvalidated data flow into components.
- No mocked or hard-coded data in the app. The UI shows real API data or an explicit loading/empty/error state. Test fixtures belong in tests only.

## Async UI states

Every async UI has all three states, each with a specific, actionable message:

- **Loading** — skeleton or spinner with an accessible label (`aria-busy`, `role="status"`).
- **Empty** — says what is empty and what to do ("No saved cities yet. Search for a city and tap the star to save it.").
- **Error** — says what failed and offers a retry where possible ("Couldn't load the forecast for Lisbon. Check your connection and try again."). Never a bare "Something went wrong".

## Accessibility (by default, not as a follow-up)

- Everything works with a keyboard alone: logical tab order, visible focus styles, no keyboard traps, `Escape` closes overlays.
- Semantic HTML first; ARIA only where semantics fall short. Every interactive control has an accessible name. Live regions announce async results.
- Touch targets are at least 44×44 CSS px.
- Colour contrast meets WCAG 2.2 AA; information is never conveyed by colour alone. Respect `prefers-reduced-motion`.

## Rendering rules

- **Derive, don't store.** If a value can be computed from props or state, compute it during render. No `useEffect` that copies state into state.
- **Memoize only with a measured reason.** `useMemo`/`useCallback`/`React.memo` need a profiler measurement or a referential-stability requirement (e.g. a dependency of another hook), noted in a comment.
- **Stable keys and callbacks.** List keys are stable IDs, never array indexes. Callbacks passed to memoized children or used as hook dependencies are stable.
- **Keep state low.** Split components so state lives in the lowest component that needs it; lift only when siblings must share it.
- **Lazy-load non-critical UI** (`React.lazy` + `Suspense`): settings, dialogs, charts, anything below the fold or behind an interaction.

## Definition of done

A change is done only when all of these pass locally (`npm run verify`) and in CI:

1. `lint` — ESLint, zero warnings
2. `typecheck` — `tsc -b` (all project references, no emit)
3. `test` — unit/component tests, including loading/empty/error states
4. `build` — production build succeeds
5. `e2e` — Playwright end-to-end tests
