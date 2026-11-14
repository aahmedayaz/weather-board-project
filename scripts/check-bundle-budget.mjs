#!/usr/bin/env node
// Fails the build when the JavaScript needed for first render exceeds the budget.
// "Initial JS" = the entry <script type="module"> plus every <link rel="modulepreload"> in
// dist/index.html, measured gzipped (what users actually download). Lazy chunks don't count.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 150;
const outDir = process.argv[2] ?? 'dist';
const html = readFileSync(join(outDir, 'index.html'), 'utf8');

const initial = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g),
].map((match) => match[1]);

let totalBytes = 0;
for (const file of new Set(initial)) {
  const gzipped = gzipSync(readFileSync(join(outDir, file)), { level: 9 }).length;
  totalBytes += gzipped;
  console.log(`  ${file.padEnd(48)} ${(gzipped / 1024).toFixed(1).padStart(7)} kB gz`);
}

const totalKb = totalBytes / 1024;
const summary = `Initial JS: ${totalKb.toFixed(1)} kB gzipped (budget ${String(BUDGET_KB)} kB)`;
if (totalKb > BUDGET_KB) {
  console.error(`✖ ${summary} — over budget. Run \`npm run analyze\` to see what grew.`);
  process.exit(1);
}
console.log(`✓ ${summary}`);
