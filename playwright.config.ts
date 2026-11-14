import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'on-first-retry',
    // The production build registers a service worker, which would answer requests itself
    // and bypass page.route() mocks. Blocked by default; e2e/pwa.spec.ts opts back in.
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Tests run against the production build (`vite preview`), not the dev server:
  // the service worker and PWA behaviour only exist in the built app.
  // Run `npm run build` first, or use `npm run verify`, which builds before e2e.
  webServer: {
    command: 'npm run preview',
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
