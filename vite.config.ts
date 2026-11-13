import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { handleCitiesRequest } from './api/_lib/cities-handler.ts';

/**
 * Dev only: serve the Vercel function at /api/cities from `vite dev`, using the same handler
 * and server-only env from .env.local (no `vercel dev` login needed). Production uses api/.
 */
function apiDevServer(): Plugin {
  return {
    name: 'weatherboard:api-dev',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      server.middlewares.use('/api/cities', (req, res) => {
        const url = new URL(req.originalUrl ?? '/api/cities', 'http://localhost');
        void handleCitiesRequest(new Request(url), { env, fetch }).then(async (response) => {
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          res.end(await response.text());
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevServer()],
  resolve: {
    // Mirrors `paths` in tsconfig.app.json.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  preview: { port: 4173, strictPort: true },
});
