import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchWeather, WeatherError } from './fetchWeather';

const bundle = {
  source: 'Open-Meteo',
  timezoneOffsetSeconds: 18_000,
  current: {
    observedAt: 1_794_650_400,
    temperatureC: 29,
    feelsLikeC: 31,
    humidity: 60,
    windSpeedMs: 4,
    condition: 'clear',
    isDay: true,
  },
  daily: [],
};

function respond(response: Response | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response))),
  );
}

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

const signal = () => new AbortController().signal;
const coords = { lat: 24.86, lon: 67 };

describe('fetchWeather', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a validated bundle', async () => {
    respond(Response.json(bundle));
    await expect(fetchWeather(coords, signal())).resolves.toEqual(bundle);
  });

  it.each([
    ['offline', new TypeError('Failed to fetch'), null],
    [
      'rate-limited',
      Response.json({ error: { code: 'RATE_LIMITED', message: 'slow' } }, { status: 429 }),
      429,
    ],
    [
      'not-found',
      Response.json({ error: { code: 'NOT_FOUND', message: 'none' } }, { status: 404 }),
      404,
    ],
    [
      'not-found',
      Response.json({ error: { code: 'INVALID_COORDINATES', message: 'bad' } }, { status: 400 }),
      400,
    ],
    [
      'server',
      Response.json({ error: { code: 'UPSTREAM_ERROR', message: 'boom' } }, { status: 502 }),
      502,
    ],
    ['server', new Response('<html>gateway</html>', { status: 504 }), 504],
    ['server', Response.json({ source: 'Somewhere' }), 200],
  ] as const)('maps to %s (status %s)', async (kind, response, status) => {
    respond(response);
    const error = await errorOf(fetchWeather(coords, signal()));
    expect(error).toBeInstanceOf(WeatherError);
    expect(error).toMatchObject({ kind, status });
  });

  it('rethrows aborts untouched', async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException('aborted', 'AbortError');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(abort)),
    );
    await expect(fetchWeather(coords, controller.signal)).rejects.toBe(abort);
  });
});
