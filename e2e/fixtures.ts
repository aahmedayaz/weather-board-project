import { test as base, type Route } from '@playwright/test';

/** Matches GET /api/weather?lat=…&lon=… */
export const WEATHER_API = /\/api\/weather\?/;

export const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export function weatherBundle(overrides: Record<string, unknown> = {}) {
  return {
    source: 'Open-Meteo',
    timezoneOffsetSeconds: 18_000,
    current: {
      observedAt: Date.UTC(2026, 10, 14, 9, 0) / 1000,
      temperatureC: 29.4,
      feelsLikeC: 31.2,
      humidity: 58,
      windSpeedMs: 4.6,
      condition: 'partly-cloudy',
      isDay: true,
    },
    daily: [
      {
        date: '2026-11-14',
        minC: 22,
        maxC: 31,
        condition: 'partly-cloudy',
        precipitationChance: 0.1,
      },
      { date: '2026-11-15', minC: 21, maxC: 30, condition: 'clear', precipitationChance: 0 },
      { date: '2026-11-16', minC: 20, maxC: 28, condition: 'rain', precipitationChance: 0.7 },
      { date: '2026-11-17', minC: 21, maxC: 29, condition: 'cloudy', precipitationChance: 0.2 },
      { date: '2026-11-18', minC: 22, maxC: 30, condition: 'clear', precipitationChance: 0 },
    ],
    ...overrides,
  };
}

/**
 * Every page load fetches weather, so every spec gets a deterministic default response.
 * Tests that need another state register their own route, which takes precedence.
 */
export const test = base.extend<{ mockWeather: undefined }>({
  mockWeather: [
    async ({ page }, use) => {
      await page.route(WEATHER_API, (route) => json(route, 200, weatherBundle()));
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
