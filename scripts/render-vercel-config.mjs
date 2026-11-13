#!/usr/bin/env node
// Fills the CSP placeholders in vercel.json from environment variables.
//
// vercel.json is static: Vercel reads it as-is and never substitutes env vars. So this
// runs in the deploy job *before* `vercel build` / `vercel deploy --prebuilt`:
//
//   PROXY_URL=https://proxy.example.com WORKER_URL=https://wb.example.workers.dev \
//     npm run vercel:config -- --write
//
// Without --write it prints the rendered CSP and changes nothing (dry run).
// PROXY_URL is optional (omit it when the proxy is same-origin under /api — 'self' covers it).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const configPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'vercel.json');

const httpsOrigin = z
  .url({ protocol: /^https$/, error: 'must be an https URL' })
  .transform((value) => new URL(value).origin);

const EnvSchema = z.object({
  PROXY_URL: z.preprocess((v) => (v === '' ? undefined : v), httpsOrigin.optional()),
  WORKER_URL: httpsOrigin,
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(`render-vercel-config: invalid environment\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

const source = readFileSync(configPath, 'utf8');
if (!source.includes('__WORKER_ORIGIN__')) {
  console.error('render-vercel-config: vercel.json has no placeholders (already rendered?).');
  process.exit(1);
}

const rendered = source
  .replace(/ __PROXY_ORIGIN__/g, parsed.data.PROXY_URL ? ` ${parsed.data.PROXY_URL}` : '')
  .replace(/__WORKER_ORIGIN__/g, parsed.data.WORKER_URL);

JSON.parse(rendered); // fail loudly if the result is not valid JSON

if (process.argv.includes('--write')) {
  writeFileSync(configPath, rendered, 'utf8');
  console.log('render-vercel-config: vercel.json updated.');
} else {
  const csp = /"Content-Security-Policy",\s*"value": "([^"]+)"/.exec(rendered)?.[1];
  console.log(`Dry run (pass --write to apply). CSP:\n${csp ?? '(not found)'}`);
}
