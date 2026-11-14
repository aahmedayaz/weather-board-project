// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiErrorResponseSchema } from '../../src/shared/api/api-error.js';
import { WeatherBundleSchema } from '../../src/shared/api/weather-contract.js';

import { handleWeatherRequest, WEATHER_CACHE_CONTROL } from './weather-handler.js';

const NOW = Date.UTC(2026, 10, 14, 9) / 1000; // 09:00 UTC = 14:00 in Karachi (UTC+5)
const KARACHI_OFFSET = 5 * 3600;

// ---- Upstream fixtures (trimmed to the fields the providers read) ----------------------
const owmCurrent = {
  dt: NOW,
  timezone: KARACHI_OFFSET,
  weather: [{ id: 801, icon: '02d' }],
  main: { temp: 29.4, feels_like: 31.2, humidity: 58 },
  wind: { speed: 4.6 },
};
const owmForecast = {
  city: { timezone: KARACHI_OFFSET },
  // 40 three-hour slots starting at the next slot = 5+ local days.
  list: Array.from({ length: 40 }, (_, index) => ({
    dt: NOW + (index + 1) * 3 * 3600,
    main: { temp: 24 + (index % 8) },
    weather: [{ id: index % 8 < 2 ? 500 : 800 }],
    pop: index % 8 < 2 ? 0.6 : 0,
  })),
};
const hours = Array.from({ length: 6 * 24 }, (_, index) => NOW - 9 * 3600 + index * 3600);
const openMeteo = {
  utc_offset_seconds: KARACHI_OFFSET,
  current: {
    time: NOW,
    temperature_2m: 28.9,
    apparent_temperature: 30.1,
    relative_humidity_2m: 61,
    weather_code: 3,
    wind_speed_10m: 5.2,
    is_day: 1,
  },
  hourly: {
    time: hours,
    temperature_2m: hours.map((_, index) => 22 + (index % 24) / 2),
    weather_code: hours.map(() => 0),
    precipitation_probability: hours.map((_, index) => (index % 24 === 15 ? 40 : null)),
  },
};

// ---- Fake upstream: route by host ------------------------------------------------------
type Reply = () => Promise<Response>;
const json =
  (body: unknown, init: ResponseInit = {}) =>
  () =>
    Promise.resolve(Response.json(body, init));
const status =
  (code: number, headers: Record<string, string> = {}) =>
  () =>
    Promise.resolve(new Response('upstream error', { status: code, headers }));
const networkError: Reply = () => Promise.reject(new TypeError('fetch failed'));

function upstream({
  owmWeather = json(owmCurrent),
  owmForecast: forecast = json(owmForecast),
  meteo = json(openMeteo),
}: { owmWeather?: Reply; owmForecast?: Reply; meteo?: Reply } = {}) {
  return vi.fn<typeof fetch>((input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname === 'api.openweathermap.org') {
      return url.pathname.endsWith('/forecast') ? forecast() : owmWeather();
    }
    if (url.hostname === 'api.open-meteo.com') return meteo();
    return Promise.reject(new Error(`unexpected host ${url.hostname}`));
  });
}

const env = { OPENWEATHER_API_KEY: 'owm-test-key' };

function request(query: string) {
  return new Request(`https://weatherboard.test/api/weather?${query}`);
}

async function bundleOf(response: Response) {
  return WeatherBundleSchema.parse(await response.json());
}
async function errorOf(response: Response) {
  return ApiErrorResponseSchema.parse(await response.json()).error;
}
const hostsCalled = (fetchMock: ReturnType<typeof upstream>) =>
  fetchMock.mock.calls.map(
    ([input]) => new URL(input instanceof Request ? input.url : input).hostname,
  );

describe('GET /api/weather', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['missing lat and lon', ''],
    ['missing lon', 'lat=24.86'],
    ['non-numeric lat', 'lat=abc&lon=67'],
    ['lat out of range', 'lat=91&lon=67'],
    ['lon out of range', 'lat=24&lon=-181'],
  ])('rejects %s with 400 INVALID_COORDINATES without calling upstream', async (_, query) => {
    const fetchMock = upstream();
    const response = await handleWeatherRequest(request(query), { env, fetch: fetchMock });
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe('INVALID_COORDINATES');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves OpenWeatherMap in metric units, normalized and aggregated into 5 days', async () => {
    const fetchMock = upstream();
    const response = await handleWeatherRequest(request('lat=24.8607&lon=67.0011'), {
      env,
      fetch: fetchMock,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(WEATHER_CACHE_CONTROL);
    const bundle = await bundleOf(response);
    expect(bundle.source).toBe('OpenWeatherMap');
    expect(bundle.current).toEqual({
      observedAt: NOW,
      temperatureC: 29.4,
      feelsLikeC: 31.2,
      humidity: 58,
      windSpeedMs: 4.6,
      condition: 'partly-cloudy',
      isDay: true,
    });
    expect(bundle.daily).toHaveLength(5);
    expect(bundle.daily[0]?.date).toBe('2026-11-14');

    const firstInput = fetchMock.mock.calls[0]?.[0];
    const owmUrl = new URL(firstInput instanceof Request ? firstInput.url : (firstInput ?? ''));
    expect(owmUrl.searchParams.get('units')).toBe('metric');
    expect(owmUrl.searchParams.get('appid')).toBe('owm-test-key');
    expect(hostsCalled(fetchMock)).not.toContain('api.open-meteo.com');
  });

  it.each([
    ['429 rate limit', status(429)],
    ['500', status(500)],
    ['503', status(503)],
    ['network failure', networkError],
    ['an unparseable body', json({ unexpected: true })],
    ['a rejected key (401)', status(401)],
  ])('falls back to Open-Meteo on %s with the same bundle shape', async (_, reply) => {
    const fetchMock = upstream({ owmWeather: reply });
    const response = await handleWeatherRequest(request('lat=24.86&lon=67.01'), {
      env,
      fetch: fetchMock,
    });

    expect(response.status).toBe(200);
    const bundle = await bundleOf(response);
    expect(bundle.source).toBe('Open-Meteo');
    expect(bundle.current.condition).toBe('cloudy'); // WMO 3
    expect(bundle.daily.length).toBeGreaterThanOrEqual(5);
    expect(bundle.daily[0]?.precipitationChance).toBe(0.4);
  });

  it('falls back when the forecast call fails even if current conditions succeeded', async () => {
    const fetchMock = upstream({ owmForecast: status(502) });
    const bundle = await bundleOf(
      await handleWeatherRequest(request('lat=1&lon=1'), { env, fetch: fetchMock }),
    );
    expect(bundle.source).toBe('Open-Meteo');
  });

  it('uses Open-Meteo directly when no OpenWeatherMap key is configured', async () => {
    const fetchMock = upstream();
    const bundle = await bundleOf(
      await handleWeatherRequest(request('lat=1&lon=1'), { env: {}, fetch: fetchMock }),
    );
    expect(bundle.source).toBe('Open-Meteo');
    expect(hostsCalled(fetchMock)).toEqual(['api.open-meteo.com']);
  });

  it('does not fall back on 404: returns NOT_FOUND', async () => {
    const fetchMock = upstream({ owmWeather: status(404) });
    const response = await handleWeatherRequest(request('lat=1&lon=1'), { env, fetch: fetchMock });
    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe('NOT_FOUND');
    expect(hostsCalled(fetchMock)).not.toContain('api.open-meteo.com');
  });

  it('returns RATE_LIMITED with Retry-After when both sources are rate limited', async () => {
    const fetchMock = upstream({
      owmWeather: status(429),
      meteo: status(429, { 'Retry-After': '45' }),
    });
    const response = await handleWeatherRequest(request('lat=1&lon=1'), { env, fetch: fetchMock });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('45');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await errorOf(response)).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 45 });
  });

  it('returns 502 UPSTREAM_ERROR when both sources fail with 5xx', async () => {
    const fetchMock = upstream({ owmWeather: status(500), meteo: status(500) });
    const response = await handleWeatherRequest(request('lat=1&lon=1'), { env, fetch: fetchMock });
    expect(response.status).toBe(502);
    expect((await errorOf(response)).code).toBe('UPSTREAM_ERROR');
  });

  it('returns 503 UPSTREAM_UNAVAILABLE when both sources are unreachable', async () => {
    const fetchMock = upstream({ owmWeather: networkError, meteo: networkError });
    const response = await handleWeatherRequest(request('lat=1&lon=1'), { env, fetch: fetchMock });
    expect(response.status).toBe(503);
    expect((await errorOf(response)).code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
