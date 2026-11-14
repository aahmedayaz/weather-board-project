import { z } from 'zod';

import type { Coordinates } from '../../../src/shared/api/weather-contract.js';
import { fetchJson } from '../upstream.js';

import { aggregateDaily, type ForecastSlot } from './aggregate.js';
import { conditionFromWmoCode } from './conditions.js';
import type { ProviderResult } from './openweathermap.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const nullableNumbers = z.array(z.number().nullable());

const ResponseSchema = z.object({
  utc_offset_seconds: z.number().int(),
  current: z.object({
    time: z.number().int(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number().int(),
    wind_speed_10m: z.number(),
    is_day: z.union([z.literal(0), z.literal(1)]),
  }),
  hourly: z.object({
    time: z.array(z.number().int()),
    temperature_2m: nullableNumbers,
    weather_code: nullableNumbers,
    precipitation_probability: nullableNumbers,
  }),
});

/**
 * Fallback provider: no API key, generous limits. Hourly samples from the current hour on
 * are aggregated with the same pure function as OpenWeatherMap's 3-hour slots.
 */
export async function fetchOpenMeteo(
  { lat, lon }: Coordinates,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<ProviderResult> {
  const url = new URL(BASE_URL);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    wind_speed_unit: 'ms',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '6',
  }).toString();

  const result = await fetchJson(fetchImpl, url, signal);
  if (!result.ok) return result;

  const parsed = ResponseSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, failure: { kind: 'invalid-response' } };
  const { current, hourly, utc_offset_seconds: offset } = parsed.data;

  // Match OpenWeatherMap, whose forecast starts at the next slot: skip hours already past.
  const fromTime = current.time - 3600;
  const slots: ForecastSlot[] = [];
  hourly.time.forEach((time, index) => {
    const temperatureC = hourly.temperature_2m[index];
    const code = hourly.weather_code[index];
    if (time < fromTime || temperatureC == null || code == null) return;
    slots.push({
      time,
      temperatureC,
      condition: conditionFromWmoCode(code),
      precipitationChance: (hourly.precipitation_probability[index] ?? 0) / 100,
    });
  });

  return {
    ok: true,
    bundle: {
      source: 'Open-Meteo',
      timezoneOffsetSeconds: offset,
      current: {
        observedAt: current.time,
        temperatureC: current.temperature_2m,
        feelsLikeC: current.apparent_temperature,
        humidity: Math.min(100, Math.max(0, current.relative_humidity_2m)),
        windSpeedMs: Math.max(0, current.wind_speed_10m),
        condition: conditionFromWmoCode(current.weather_code),
        isDay: current.is_day === 1,
      },
      daily: aggregateDaily(slots, offset),
    },
  };
}
