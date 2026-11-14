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
  // Tests run against a production build (`vite preview`), not the dev server: the service
  // worker and PWA behaviour only exist in a build. It is a dedicated `--mode e2e` build so
  // public test config (.env.e2e: fake push-worker URL, throwaway VAPID key) is always present.
  webServer: {
    command:
      'npx vite build --mode e2e --outDir dist-e2e --logLevel warn && npx vite preview --outDir dist-e2e',
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
