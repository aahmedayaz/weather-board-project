/**
 * Contract for GET /api/weather?lat=&lon= → WeatherBundle.
 * Both providers (OpenWeatherMap, Open-Meteo) are normalized into this one shape, so the
 * client never branches on which source answered. Only imports `zod` (browser + Node).
 */
import { z } from 'zod';

export const LatitudeSchema = z.coerce.number().min(-90).max(90);
export const LongitudeSchema = z.coerce.number().min(-180).max(180);

export const CoordinatesSchema = z.object({ lat: LatitudeSchema, lon: LongitudeSchema });
export type Coordinates = z.infer<typeof CoordinatesSchema>;

/** Provider-neutral condition, ordered from least to most severe. */
export const WEATHER_CONDITIONS = [
  'clear',
  'partly-cloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'snow',
  'thunderstorm',
] as const;
export const WeatherConditionSchema = z.enum(WEATHER_CONDITIONS);
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

export const WeatherSourceSchema = z.enum(['OpenWeatherMap', 'Open-Meteo']);
export type WeatherSource = z.infer<typeof WeatherSourceSchema>;

export const CurrentConditionsSchema = z.object({
  /** Observation time, Unix seconds. */
  observedAt: z.number().int(),
  temperatureC: z.number(),
  feelsLikeC: z.number(),
  /** 0–100 %. */
  humidity: z.number().min(0).max(100),
  windSpeedMs: z.number().min(0),
  condition: WeatherConditionSchema,
  isDay: z.boolean(),
});
export type CurrentConditions = z.infer<typeof CurrentConditionsSchema>;

export const DailyForecastSchema = z.object({
  /** Local calendar date at the location, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minC: z.number(),
  maxC: z.number(),
  condition: WeatherConditionSchema,
  /** Highest chance of precipitation in any slot that day, 0–1. */
  precipitationChance: z.number().min(0).max(1),
});
export type DailyForecast = z.infer<typeof DailyForecastSchema>;

export const WeatherBundleSchema = z.object({
  source: WeatherSourceSchema,
  /** Offset of the location's local time from UTC, in seconds. */
  timezoneOffsetSeconds: z.number().int(),
  current: CurrentConditionsSchema,
  daily: z.array(DailyForecastSchema).max(5),
});
export type WeatherBundle = z.infer<typeof WeatherBundleSchema>;

/** YYYY-MM-DD of a UTC instant (Unix seconds) as seen at a location offsetSeconds from UTC. */
export function localDate(unixSeconds: number, offsetSeconds: number): string {
  return new Date((unixSeconds + offsetSeconds) * 1000).toISOString().slice(0, 10);
}
