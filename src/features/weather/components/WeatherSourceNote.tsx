import type { Coordinates } from '@/shared/api/weather-contract';

import { selectSource, useWeather } from '../api/weatherQuery';

/** Small attribution footer. Subscribes to `source` only. */
export function WeatherSourceNote({ coordinates }: { coordinates: Coordinates }) {
  const { data: source } = useWeather(coordinates, selectSource);
  if (!source) return null;
  return <p className="mt-3 text-xs text-fg-muted">Weather data: {source}</p>;
}
