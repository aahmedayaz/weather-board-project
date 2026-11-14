import type { City } from '@/shared/api/cities-contract';
import type { DailyForecast, WeatherBundle } from '@/shared/api/weather-contract';

/** Test-only fixtures (CLAUDE.md: no mocked data in the app; fixtures live with tests). */
export const lisbon: City = {
  id: 1,
  name: 'Lisbon',
  region: 'Lisbon District',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.13,
};

const days: DailyForecast[] = [
  { date: '2026-11-14', minC: 14, maxC: 21, condition: 'partly-cloudy', precipitationChance: 0.1 },
  { date: '2026-11-15', minC: 13, maxC: 19, condition: 'rain', precipitationChance: 0.8 },
  { date: '2026-11-16', minC: 12, maxC: 18, condition: 'cloudy', precipitationChance: 0.3 },
  { date: '2026-11-17', minC: 11, maxC: 20, condition: 'clear', precipitationChance: 0 },
  { date: '2026-11-18', minC: 12, maxC: 22, condition: 'clear', precipitationChance: 0 },
];

export function makeBundle(overrides: Partial<WeatherBundle> = {}): WeatherBundle {
  return {
    source: 'OpenWeatherMap',
    timezoneOffsetSeconds: 0,
    current: {
      observedAt: Date.UTC(2026, 10, 14, 13, 5) / 1000,
      temperatureC: 19.6,
      feelsLikeC: 18.2,
      humidity: 64,
      windSpeedMs: 5,
      condition: 'partly-cloudy',
      isDay: true,
    },
    daily: structuredClone(days),
    ...overrides,
  };
}
