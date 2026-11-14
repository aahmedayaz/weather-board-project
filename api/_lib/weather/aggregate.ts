import {
  localDate,
  WEATHER_CONDITIONS,
  type DailyForecast,
  type WeatherCondition,
} from '../../../src/shared/api/weather-contract.js';

/** One forecast sample (OpenWeatherMap: every 3 h; Open-Meteo: hourly). */
export interface ForecastSlot {
  /** Unix seconds (UTC). */
  time: number;
  temperatureC: number;
  condition: WeatherCondition;
  /** 0–1. */
  precipitationChance: number;
}

export { localDate };

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The most frequent condition. Ties go to the more severe one (later in WEATHER_CONDITIONS):
 * a day that is half clear and half thunderstorms should not read as "clear".
 */
export function dominantCondition(conditions: readonly WeatherCondition[]): WeatherCondition {
  const counts = new Map<WeatherCondition, number>();
  for (const condition of conditions) counts.set(condition, (counts.get(condition) ?? 0) + 1);

  let best: WeatherCondition = 'clear';
  let bestCount = 0;
  for (const condition of WEATHER_CONDITIONS) {
    const count = counts.get(condition) ?? 0;
    if (count > 0 && count >= bestCount) {
      best = condition;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Groups forecast slots into local calendar days and summarizes each:
 * min/max temperature, dominant condition, and the highest precipitation chance.
 * Pure: same input → same output, no clock, no I/O. Returns at most `days` entries,
 * earliest first.
 */
export function aggregateDaily(
  slots: readonly ForecastSlot[],
  timezoneOffsetSeconds: number,
  days = 5,
): DailyForecast[] {
  const byDate = new Map<string, ForecastSlot[]>();
  for (const slot of [...slots].sort((a, b) => a.time - b.time)) {
    const date = localDate(slot.time, timezoneOffsetSeconds);
    const bucket = byDate.get(date);
    if (bucket) bucket.push(slot);
    else byDate.set(date, [slot]);
  }

  return [...byDate.entries()].slice(0, days).map(([date, daySlots]) => {
    const temperatures = daySlots.map((slot) => slot.temperatureC);
    return {
      date,
      minC: round1(Math.min(...temperatures)),
      maxC: round1(Math.max(...temperatures)),
      condition: dominantCondition(daySlots.map((slot) => slot.condition)),
      precipitationChance: round2(Math.max(...daySlots.map((slot) => slot.precipitationChance))),
    };
  });
}
