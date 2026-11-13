/**
 * Lighthouse CI config. Runs against the production build in ./dist (run `npm run build` first).
 *
 * PWA: Lighthouse 12+ removed the "pwa" category and its audits (installable-manifest,
 * service-worker, …), so there is nothing to assert here any more. When the PWA feature
 * lands, cover it in Playwright instead: manifest is served and valid, the service worker
 * registers and controls the page, and the app shell loads offline.
 */
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      // Reports stay on disk (uploaded as a CI artifact) instead of public temporary storage.
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
