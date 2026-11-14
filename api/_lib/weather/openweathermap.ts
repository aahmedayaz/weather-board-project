import { z } from 'zod';

import type { Coordinates, WeatherBundle } from '../../../src/shared/api/weather-contract.js';
import { fetchJson, type UpstreamFailure } from '../upstream.js';

import { aggregateDaily } from './aggregate.js';
import { conditionFromOpenWeatherId } from './conditions.js';

const BASE_URL = 'https://api.openweathermap.org/data/2.5';

const ConditionListSchema = z.array(z.object({ id: z.number().int(), icon: z.string() })).min(1);

const CurrentSchema = z.object({
  dt: z.number().int(),
  timezone: z.number().int(),
  weather: ConditionListSchema,
  main: z.object({ temp: z.number(), feels_like: z.number(), humidity: z.number() }),
  wind: z.object({ speed: z.number() }),
});

const ForecastSchema = z.object({
  list: z.array(
    z.object({
      dt: z.number().int(),
      main: z.object({ temp: z.number() }),
      weather: z.array(z.object({ id: z.number().int() })).min(1),
      pop: z.number().min(0).max(1).default(0),
    }),
  ),
  city: z.object({ timezone: z.number().int() }),
});

export type ProviderResult =
  { ok: true; bundle: WeatherBundle } | { ok: false; failure: UpstreamFailure };

/** Current conditions + 5-day/3-hour forecast, metric units, fetched in parallel. */
export async function fetchOpenWeatherMap(
  { lat, lon }: Coordinates,
  apiKey: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<ProviderResult> {
  const url = (path: string) => {
    const result = new URL(`${BASE_URL}/${path}`);
    result.search = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      units: 'metric',
      appid: apiKey,
    }).toString();
    return result;
  };

  const [currentResult, forecastResult] = await Promise.all([
    fetchJson(fetchImpl, url('weather'), signal),
    fetchJson(fetchImpl, url('forecast'), signal),
  ]);
  if (!currentResult.ok) return currentResult;
  if (!forecastResult.ok) return forecastResult;

  const current = CurrentSchema.safeParse(currentResult.data);
  const forecast = ForecastSchema.safeParse(forecastResult.data);
  if (!current.success || !forecast.success) {
    return { ok: false, failure: { kind: 'invalid-response' } };
  }

  const now = current.data;
  const [nowCondition] = now.weather;
  if (!nowCondition) return { ok: false, failure: { kind: 'invalid-response' } };

  return {
    ok: true,
    bundle: {
      source: 'OpenWeatherMap',
      timezoneOffsetSeconds: forecast.data.city.timezone,
      current: {
        observedAt: now.dt,
        temperatureC: now.main.temp,
        feelsLikeC: now.main.feels_like,
        humidity: Math.min(100, Math.max(0, now.main.humidity)),
        windSpeedMs: Math.max(0, now.wind.speed),
        condition: conditionFromOpenWeatherId(nowCondition.id),
        isDay: nowCondition.icon.endsWith('d'),
      },
      daily: aggregateDaily(
        forecast.data.list.map((entry) => ({
          time: entry.dt,
          temperatureC: entry.main.temp,
          condition: conditionFromOpenWeatherId(entry.weather[0]?.id ?? 804),
          precipitationChance: entry.pop,
        })),
        forecast.data.city.timezone,
      ),
    },
  };
}
