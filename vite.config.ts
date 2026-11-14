import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

import { handleCitiesRequest } from './api/_lib/cities-handler.ts';
import { handleWeatherRequest } from './api/_lib/weather-handler.ts';

type Handler = (
  request: Request,
  deps: { env: Record<string, string | undefined>; fetch: typeof fetch },
) => Promise<Response>;

/** Mirrors the files in api/. */
const API_ROUTES: Record<string, Handler> = {
  '/api/cities': handleCitiesRequest,
  '/api/weather': handleWeatherRequest,
};

/**
 * Dev only: serve the Vercel functions in api/ from `vite dev`, using the same handlers and
 * server-only env from .env.local (no `vercel dev` login needed). Production uses api/.
 */
function apiDevServer(): Plugin {
  return {
    name: 'weatherboard:api-dev',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const [route, handler] of Object.entries(API_ROUTES)) {
        server.middlewares.use(route, (req, res) => {
          const url = new URL(req.originalUrl ?? route, 'http://localhost');
          void handler(new Request(url), { env, fetch }).then(async (response) => {
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });
            res.end(await response.text());
          });
        });
      }
    },
  };
}

interface HeadTag {
  tag: string;
  attrs: Record<string, string | boolean>;
  injectTo: 'head-prepend';
}

/**
 * Build-time <head> hints:
 * - preload the Latin Inter file (its hashed name is only known after bundling), so the font
 *   request starts with the HTML instead of waiting for the CSS to be parsed;
 * - preconnect to the push worker's origin when one is configured. The weather and city APIs
 *   are same-origin (/api), so they need no preconnect.
 */
function headHints(pushWorkerUrl: string | undefined): Plugin {
  return {
    name: 'weatherboard:head-hints',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const tags: HeadTag[] = [];
        const font = Object.keys(context.bundle ?? {}).find((file) =>
          /inter-latin-wght-normal-[\w-]+\.woff2$/.test(file),
        );
        if (font) {
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `/${font}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: true,
            },
            injectTo: 'head-prepend',
          });
        }
        if (pushWorkerUrl) {
          tags.push({
            tag: 'link',
            attrs: { rel: 'preconnect', href: new URL(pushWorkerUrl).origin, crossorigin: true },
            injectTo: 'head-prepend',
          });
        }
        return tags;
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    apiDevServer(),
    headHints(loadEnv(mode, process.cwd(), 'VITE_').VITE_PUSH_WORKER_URL),
    // `npm run analyze` → dist/stats.html (treemap with gzip sizes).
    mode === 'analyze' &&
      visualizer({ filename: 'dist/stats.html', gzipSize: true, template: 'treemap' }),
    VitePWA({
      // injectManifest: we own src/sw.ts (push handlers will live there too); the plugin only
      // compiles it and injects the precache list.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // The update toast asks before activating a new version; registration happens in
      // src/features/pwa (injectRegister: false) so the app controls the UI.
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        // Precache only the Latin font subsets the UI uses; the other Inter subsets still load
        // on demand (unicode-range) when online, instead of costing every install ~220 KB.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/inter-latin-*.woff2'],
      },
      manifest: {
        id: '/',
        name: 'WeatherBoard',
        short_name: 'WeatherBoard',
        description: 'Current conditions and 5-day forecasts for your cities.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#5359d1', // --wb-accent
        background_color: '#f7f8fa', // --wb-canvas (light)
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    // Mirrors `paths` in tsconfig.app.json.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  preview: { port: 4173, strictPort: true },
}));
