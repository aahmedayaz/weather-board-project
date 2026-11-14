import { describe, expect, it, vi } from 'vitest';

import { handleRequest, parseAllowedOrigins, type AppDeps } from './app';
import type { SubscriptionWriter } from './store';

const ORIGIN = 'https://weatherboard.test';
// 01:00 UTC = 06:00 in Karachi.
const NOW = new Date(Date.UTC(2026, 10, 14, 1, 0));

const validBody = {
  subscription: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    expirationTime: null,
    keys: {
      p256dh: 'B'.repeat(87),
      auth: 'a'.repeat(22),
    },
  },
  reminderTime: '07:30',
  timezone: 'Asia/Karachi',
  city: { name: 'Karachi', lat: 24.86, lon: 67.0 },
};

function setup() {
  // Mocks kept as standalone functions so assertions never detach a method from `this`.
  const upsert = vi.fn<SubscriptionWriter['upsert']>(() => Promise.resolve());
  const remove = vi.fn<SubscriptionWriter['remove']>(() => Promise.resolve());
  const deps: AppDeps = { store: { upsert, remove }, allowedOrigins: [ORIGIN], now: () => NOW };
  return { store: { upsert, remove }, deps };
}

function post(path: string, body: unknown, origin: string | null = ORIGIN) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin) headers.set('Origin', origin);
  return new Request(`https://push.weatherboard.test${path}`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function codeOf(response: Response) {
  const body: unknown = await response.json();
  return typeof body === 'object' && body !== null && 'error' in body
    ? (body.error as { code: string }).code
    : null;
}

describe('push worker HTTP API', () => {
  it('parses the comma-separated allowlist', () => {
    expect(parseAllowedOrigins(' https://a.test, http://localhost:5173 ,')).toEqual([
      'https://a.test',
      'http://localhost:5173',
    ]);
  });

  describe('CORS', () => {
    it('answers preflight for an allowed origin', async () => {
      const { deps } = setup();
      const response = await handleRequest(
        new Request('https://push.test/subscribe', {
          method: 'OPTIONS',
          headers: { Origin: ORIGIN },
        }),
        deps,
      );
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
      expect(response.headers.get('Vary')).toBe('Origin');
    });

    it.each([
      ['another origin', 'https://evil.test'],
      ['no origin', null],
    ])('rejects %s with 403 and no CORS headers', async (_, origin) => {
      const { deps, store } = setup();
      const response = await handleRequest(post('/subscribe', validBody, origin), deps);
      expect(response.status).toBe(403);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(store.upsert).not.toHaveBeenCalled();
    });
  });

  describe('POST /subscribe', () => {
    it('stores a valid subscription (201) and starts today when the time is still ahead', async () => {
      const { deps, store } = setup();
      const response = await handleRequest(post('/subscribe', validBody), deps);
      expect(response.status).toBe(201);
      expect(store.upsert).toHaveBeenCalledWith(validBody, null);
    });

    it('starts tomorrow when today’s reminder time has already passed', async () => {
      const { deps, store } = setup();
      await handleRequest(post('/subscribe', { ...validBody, reminderTime: '05:55' }), deps);
      expect(store.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ reminderTime: '05:55' }),
        '2026-11-14',
      );
    });

    it.each([
      ['a time that is not on a 5-minute step', { reminderTime: '07:32' }],
      ['an impossible time', { reminderTime: '24:00' }],
      ['a non-IANA time zone', { timezone: 'GMT+5' }],
      ['an unknown time zone', { timezone: 'Mars/Olympus' }],
      [
        'an http endpoint',
        { subscription: { ...validBody.subscription, endpoint: 'http://push.test/x' } },
      ],
      [
        'malformed keys',
        { subscription: { ...validBody.subscription, keys: { p256dh: 'short', auth: '!!' } } },
      ],
      ['out-of-range coordinates', { city: { name: 'X', lat: 120, lon: 0 } }],
      ['an empty city name', { city: { name: '  ', lat: 1, lon: 1 } }],
    ])('rejects %s with 400', async (_, patch) => {
      const { deps, store } = setup();
      const response = await handleRequest(post('/subscribe', { ...validBody, ...patch }), deps);
      expect(response.status).toBe(400);
      expect(await codeOf(response)).toBe('INVALID_SUBSCRIPTION');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
      expect(store.upsert).not.toHaveBeenCalled();
    });

    it('rejects invalid JSON and oversized bodies', async () => {
      const { deps } = setup();
      expect((await handleRequest(post('/subscribe', '{nope'), deps)).status).toBe(400);
      expect((await handleRequest(post('/subscribe', 'x'.repeat(9000)), deps)).status).toBe(400);
    });

    it('requires JSON and POST', async () => {
      const { deps } = setup();
      const text = new Request('https://push.test/subscribe', {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' },
        body: '{}',
      });
      expect((await handleRequest(text, deps)).status).toBe(415);
      const get = new Request('https://push.test/subscribe', { headers: { Origin: ORIGIN } });
      expect((await handleRequest(get, deps)).status).toBe(405);
    });
  });

  describe('POST /unsubscribe', () => {
    it('removes by endpoint', async () => {
      const { deps, store } = setup();
      const response = await handleRequest(
        post('/unsubscribe', { endpoint: validBody.subscription.endpoint }),
        deps,
      );
      expect(response.status).toBe(200);
      expect(store.remove).toHaveBeenCalledWith(validBody.subscription.endpoint);
    });

    it('validates the endpoint', async () => {
      const { deps, store } = setup();
      const response = await handleRequest(post('/unsubscribe', { endpoint: 'not a url' }), deps);
      expect(response.status).toBe(400);
      expect(store.remove).not.toHaveBeenCalled();
    });
  });

  it('404s unknown paths', async () => {
    const { deps } = setup();
    expect((await handleRequest(post('/admin', {}), deps)).status).toBe(404);
  });
});
