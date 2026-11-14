#!/usr/bin/env node
// Fails if anything secret-looking made it into the client build.
// - the *values* of server-only variables (from the environment and .env* files), if set;
// - their *names* (a reference means server code leaked into the bundle);
// - generic private-key / live-token patterns.
// Only variable names are ever printed — never values.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'dist';
const SERVER_ONLY = ['RAPIDAPI_KEY', 'OPENWEATHER_API_KEY', 'VAPID_PRIVATE_KEY'];
const PATTERNS = [
  ['a PEM private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a live secret key', /\bsk_live_[0-9A-Za-z]{10,}/],
  ['a RapidAPI key header with a value', /x-rapidapi-key["']?\s*[:=]\s*["'][^"']{8,}/i],
];

function envFileValues(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

const secrets = {};
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  for (const [name, value] of Object.entries(envFileValues(file))) {
    if (SERVER_ONLY.includes(name) && value.length >= 8) secrets[name] = value;
  }
}
for (const name of SERVER_ONLY) {
  const value = process.env[name];
  if (value && value.length >= 8) secrets[name] = value;
}

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|html|css|json|webmanifest|txt|map)$/.test(entry)) yield path;
  }
}

const problems = [];
for (const path of files(outDir)) {
  const text = readFileSync(path, 'utf8');
  for (const [name, value] of Object.entries(secrets)) {
    if (text.includes(value)) problems.push(`${path}: contains the value of ${name}`);
  }
  for (const name of SERVER_ONLY) {
    if (text.includes(name)) problems.push(`${path}: references ${name}`);
  }
  for (const [label, pattern] of PATTERNS) {
    if (pattern.test(text)) problems.push(`${path}: looks like ${label}`);
  }
}

if (problems.length > 0) {
  console.error(`✖ Secrets check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `✓ No secrets in ${outDir}/ (checked ${String(Object.keys(secrets).length)} local secret value(s), ${String(SERVER_ONLY.length)} names, ${String(PATTERNS.length)} patterns)`,
);
