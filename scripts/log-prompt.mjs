#!/usr/bin/env node
// Claude Code UserPromptSubmit hook: appends each prompt verbatim to PROMPTS.md.
// Contract: prints nothing to stdout (stdout would be injected into the prompt
// context), never throws, and always exits 0 so it can never block a prompt.

import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADER =
  '# Prompt log\n\n' +
  'IDE used: **Claude Code**. Every prompt submitted in this project is appended below ' +
  'verbatim by the `UserPromptSubmit` hook (`scripts/log-prompt.mjs`).\n';

const HARNESS_EVENT = /^\s*<(task-notification|side-sessions-event|ci-monitor-event)>/;

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    const timer = setTimeout(() => resolve(data), 5000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function nextNumber(content) {
  let max = 0;
  for (const match of content.matchAll(/^## Prompt (\d+)\b/gm)) {
    const n = Number(match[1]);
    if (n > max) max = n;
  }
  return max + 1;
}

// A code fence longer than any backtick run in the prompt keeps it verbatim.
function fenceFor(text) {
  let longest = 0;
  for (const run of text.match(/`+/g) ?? []) {
    if (run.length > longest) longest = run.length;
  }
  return '`'.repeat(Math.max(4, longest + 1));
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) return;

  const input = JSON.parse(raw);
  const prompt = input && typeof input.prompt === 'string' ? input.prompt : null;
  if (prompt === null) return;
  // The harness also fires UserPromptSubmit for its own events (background task
  // notifications, session/CI events). Those are not user prompts.
  if (HARNESS_EVENT.test(prompt)) return;

  const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const logPath = join(projectRoot, 'PROMPTS.md');

  if (!existsSync(logPath)) writeFileSync(logPath, HEADER, 'utf8');
  const existing = readFileSync(logPath, 'utf8');

  const fence = fenceFor(prompt);
  const entry =
    `\n## Prompt ${nextNumber(existing)} — ${new Date().toISOString()}\n\n` +
    `${fence}text\n${prompt}\n${fence}\n`;

  appendFileSync(logPath, entry, 'utf8');
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
