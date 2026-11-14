import { z } from 'zod';

import { localClock } from './clock';
import { SubscribeBodySchema, UnsubscribeBodySchema } from './schemas';
import type { SubscriptionWriter } from './store';

const MAX_BODY_BYTES = 8 * 1024;

export interface AppDeps {
  store: SubscriptionWriter;
  allowedOrigins: readonly string[];
  now: () => Date;
}

export function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}

function json(body: unknown, status: number, headers = new Headers()): Response {
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}

const error = (status: number, code: string, message: string, headers?: Headers) =>
  json({ error: { code, message } }, status, headers);

async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * POST /subscribe, POST /unsubscribe (+ CORS preflight).
 * Only origins in ALLOWED_ORIGINS may call it; every body is Zod-validated.
 */
export async function handleRequest(request: Request, deps: AppDeps): Promise<Response> {
  const { pathname } = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowed = origin !== null && deps.allowedOrigins.includes(origin);

  if (pathname !== '/subscribe' && pathname !== '/unsubscribe') {
    return error(404, 'NOT_FOUND', 'Unknown endpoint.');
  }
  if (!allowed) return error(403, 'ORIGIN_NOT_ALLOWED', 'This origin may not use reminders.');
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    cors.set('Allow', 'POST, OPTIONS');
    return error(405, 'METHOD_NOT_ALLOWED', 'Use POST.', cors);
  }
  if (!request.headers.get('Content-Type')?.includes('application/json')) {
    return error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send application/json.', cors);
  }

  const body = await readJson(request);
  if (!body.ok) return error(400, 'INVALID_JSON', 'Body must be JSON under 8 KB.', cors);

  if (pathname === '/subscribe') {
    const parsed = SubscribeBodySchema.safeParse(body.value);
    if (!parsed.success) {
      return error(400, 'INVALID_SUBSCRIPTION', z.prettifyError(parsed.error), cors);
    }
    // If today's reminder time has already passed locally, start tomorrow instead of
    // sending one immediately after the user subscribes.
    const { date, time } = localClock(deps.now(), parsed.data.timezone);
    const lastSent = parsed.data.reminderTime <= time ? date : null;
    await deps.store.upsert(parsed.data, lastSent);
    return json({ ok: true }, 201, cors);
  }

  const parsed = UnsubscribeBodySchema.safeParse(body.value);
  if (!parsed.success) return error(400, 'INVALID_ENDPOINT', z.prettifyError(parsed.error), cors);
  await deps.store.remove(parsed.data.endpoint);
  return json({ ok: true }, 200, cors);
}
