/**
 * Display units. All weather data stays metric (°C, m/s) end to end; conversion happens only
 * here, at render time — so switching units never refetches and never reloads.
 * The °C/°F switch affects temperatures only; wind is always shown in km/h.
 */
export type Units = 'metric' | 'imperial';

export const celsiusToFahrenheit = (celsius: number) => (celsius * 9) / 5 + 32;
export const metresPerSecondToKmh = (metresPerSecond: number) => metresPerSecond * 3.6;

/** Rounds and avoids "-0". */
function whole(value: number): number {
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

/** 21.6 °C → "22°" (metric) or "71°" (imperial). */
export function formatTemperature(celsius: number, units: Units): string {
  const value = units === 'metric' ? celsius : celsiusToFahrenheit(celsius);
  return `${String(whole(value))}°`;
}

/** 5 m/s → "18 km/h". Independent of the °C/°F choice. */
export function formatWind(metresPerSecond: number): string {
  return `${String(whole(metresPerSecondToKmh(metresPerSecond)))} km/h`;
}

/** Unit letter for screen readers next to a bare "22°". */
export const temperatureUnitName = (units: Units) =>
  units === 'metric' ? 'Celsius' : 'Fahrenheit';
