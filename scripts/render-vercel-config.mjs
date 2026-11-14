#!/usr/bin/env node
// Renders vercel.json from vercel.template.json, filling the CSP connect-src placeholders
// (__PROXY_ORIGIN__, __WORKER_ORIGIN__) from environment variables.
//
// Why a template: Vercel reads vercel.json as-is and never substitutes env vars, and a literal
// placeholder in a live CSP is an invalid source that browsers log as a console error on every
// page. So vercel.json is always a *rendered*, valid file:
//
//   npm run vercel:config -- --write                       # no extra origins: connect-src 'self'
//   WORKER_URL=https://wb.<you>.workers.dev npm run vercel:config -- --write
//   PROXY_URL=https://proxy.example.com WORKER_URL=… npm run vercel:config -- --write
//   npm run vercel:config -- --check                       # CI: committed file matches template
//
// Without flags it prints the rendered CSP (dry run). Both variables are optional: unset means
// "no such origin" (a same-origin proxy under /api is already covered by 'self').

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = join(root, 'vercel.template.json');
const configPath = join(root, 'vercel.json');

const optionalHttpsOrigin = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .url({ protocol: /^https$/, error: 'must be an https URL' })
    .transform((value) => new URL(value).origin)
    .optional(),
);
const EnvSchema = z.object({ PROXY_URL: optionalHttpsOrigin, WORKER_URL: optionalHttpsOrigin });

/** Renders the template; `env` defaults to none, which is what `--check` compares against. */
function render(env) {
  const source = readFileSync(templatePath, 'utf8');
  const fill = (placeholder, origin) =>
    source.includes(placeholder)
      ? (text) => text.replace(` ${placeholder}`, origin ? ` ${origin}` : '')
      : (text) => text;
  const rendered = fill(
    '__WORKER_ORIGIN__',
    env.WORKER_URL,
  )(fill('__PROXY_ORIGIN__', env.PROXY_URL)(source));
  JSON.parse(rendered); // fail loudly on invalid JSON
  if (/__[A-Z_]+_ORIGIN__/.test(rendered)) throw new Error('unrendered placeholder left in output');
  return rendered;
}

const args = process.argv.slice(2);

if (args.includes('--check')) {
  const expected = render({});
  if (readFileSync(configPath, 'utf8') !== expected) {
    console.error(
      '✖ vercel.json is out of sync with vercel.template.json. Run: npm run vercel:config -- --write',
    );
    process.exit(1);
  }
  console.log('✓ vercel.json matches vercel.template.json');
  process.exit(0);
}

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(`render-vercel-config: invalid environment\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}
const rendered = render(parsed.data);

if (args.includes('--write')) {
  writeFileSync(configPath, rendered, 'utf8');
  console.log('render-vercel-config: vercel.json written.');
} else {
  const csp = /"Content-Security-Policy",\s*"value": "([^"]+)"/.exec(rendered)?.[1];
  console.log(`Dry run (pass --write to apply). CSP:\n${csp ?? '(not found)'}`);
}
