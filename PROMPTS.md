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
