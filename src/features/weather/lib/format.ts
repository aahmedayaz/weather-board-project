import type { WeatherCondition } from '@/shared/api/weather-contract';

const CONDITION_LABELS: Record<WeatherCondition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  thunderstorm: 'Thunderstorm',
};

export const conditionLabel = (condition: WeatherCondition) => CONDITION_LABELS[condition];

/** 21.6 → "22°". Avoids "-0°". */
export function formatTemperature(celsius: number): string {
  const rounded = Math.round(celsius);
  return `${String(rounded === 0 ? 0 : rounded)}°`;
}

/** m/s → "17 km/h". */
export const formatWind = (metresPerSecond: number) =>
  `${String(Math.round(metresPerSecond * 3.6))} km/h`;

/** 0.4 → "40%". */
export const formatPercent = (fraction: number) => `${String(Math.round(fraction * 100))}%`;

// Calendar dates are already local to the city, so format them as UTC to avoid a shift.
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const weekdayLong = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const asUtcNoon = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`);

export const formatWeekdayShort = (isoDate: string) => weekdayShort.format(asUtcNoon(isoDate));
export const formatDateLong = (isoDate: string) => weekdayLong.format(asUtcNoon(isoDate));

const timeShort = new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: 'UTC' });

/** Clock time at the location: Unix seconds + the location's UTC offset. */
export const formatLocalTime = (unixSeconds: number, offsetSeconds: number) =>
  timeShort.format(new Date((unixSeconds + offsetSeconds) * 1000));

const viewerTime = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
/** Clock time in the viewer's own zone (for "Updated 14:05"). */
export const formatViewerTime = (epochMs: number) => viewerTime.format(new Date(epochMs));
