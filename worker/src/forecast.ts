import { z } from 'zod';

import type { DailyForecast } from './reminders';

const ResponseSchema = z.object({
  daily: z.object({
    temperature_2m_max: z.array(z.number()).min(1),
    temperature_2m_min: z.array(z.number()).min(1),
    precipitation_probability_max: z.array(z.number().nullable()).min(1),
    weather_code: z.array(z.number().int()).min(1),
  }),
});

function summarize(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
  if (code >= 95) return 'Thunderstorms';
  return 'Mixed conditions';
}

/** Today's forecast for a place from Open-Meteo (no key needed), validated with Zod. */
export async function fetchDailyForecast(
  lat: number,
  lon: number,
  timezone: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DailyForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone,
    forecast_days: '1',
  }).toString();

  const response = await fetchImpl(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Open-Meteo responded ${String(response.status)}`);
  const { daily } = ResponseSchema.parse(await response.json());
  const code = daily.weather_code[0] ?? 3;
  return {
    maxC: daily.temperature_2m_max[0] ?? 0,
    minC: daily.temperature_2m_min[0] ?? 0,
    precipitationChance: daily.precipitation_probability_max[0] ?? 0,
    summary: summarize(code),
  };
}
