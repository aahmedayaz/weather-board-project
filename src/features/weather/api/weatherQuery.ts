import { queryOptions, useQuery } from '@tanstack/react-query';

import {
  localDate,
  type Coordinates,
  type CurrentConditions,
  type DailyForecast,
  type WeatherBundle,
  type WeatherSource,
} from '@/shared/api/weather-contract';

import { fetchWeather, WeatherError } from './fetchWeather';

export const WEATHER_STALE_TIME_MS = 10 * 60_000;
/** Minimum gap between automatic refetches triggered by tab focus. */
export const FOCUS_REFETCH_THROTTLE_MS = 60_000;
export const MAX_SERVER_RETRIES = 3;

/** ~1 km. Nearby coordinates share one cache entry here and at the edge. */
export const roundCoordinate = (value: number) => Math.round(value * 100) / 100;

/** Retry only server problems (5xx, bad body). 4xx (rate limit, not found) and offline never. */
export function shouldRetryWeather(failureCount: number, error: unknown): boolean {
  return (
    error instanceof WeatherError && error.kind === 'server' && failureCount < MAX_SERVER_RETRIES
  );
}

/** Exponential backoff: 1 s, 2 s, 4 s … capped at 8 s. */
export function weatherRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}

/**
 * Focus throttle. TanStack already skips focus refetches while data is fresh (10 min), but
 * after a failed fetch the query stays stale — without this, every alt-tab would hit the
 * API. A focus refetch is allowed only if the last attempt (success or failure) is ≥ 60 s old.
 */
export function shouldRefetchOnFocus(
  state: { dataUpdatedAt: number; errorUpdatedAt: number },
  now: number = Date.now(),
): boolean {
  return now - Math.max(state.dataUpdatedAt, state.errorUpdatedAt) >= FOCUS_REFETCH_THROTTLE_MS;
}

/** Key, fetcher and freshness — shared by the query and by prefetching. */
export function weatherQueryCore({ lat, lon }: Coordinates) {
  const coordinates = { lat: roundCoordinate(lat), lon: roundCoordinate(lon) };
  return {
    queryKey: ['weather', coordinates.lat, coordinates.lon] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchWeather(coordinates, signal),
    staleTime: WEATHER_STALE_TIME_MS,
  };
}

export function weatherQueryOptions(coordinates: Coordinates) {
  return queryOptions({
    ...weatherQueryCore(coordinates),
    gcTime: 30 * 60_000,
    retry: shouldRetryWeather,
    retryDelay: weatherRetryDelay,
    refetchOnWindowFocus: (query) => shouldRefetchOnFocus(query.state),
  });
}

/**
 * One cached request per location; each component subscribes to the slice it renders via
 * `select`. Selected results are structurally shared, so a component re-renders only when
 * its own slice actually changed.
 */
export function useWeather<T>(coordinates: Coordinates, select: (bundle: WeatherBundle) => T) {
  return useQuery({ ...weatherQueryOptions(coordinates), select });
}

// Selectors live at module scope: a stable function identity lets TanStack skip re-running
// them on every render.
export const selectCurrent = (bundle: WeatherBundle): CurrentConditions => bundle.current;

export interface ForecastSlice {
  days: DailyForecast[];
  /** Today's date at the location, so the strip can label it "Today". */
  todayDate: string;
}
export const selectForecast = (bundle: WeatherBundle): ForecastSlice => ({
  days: bundle.daily,
  todayDate: localDate(bundle.current.observedAt, bundle.timezoneOffsetSeconds),
});

export const selectSource = (bundle: WeatherBundle): WeatherSource => bundle.source;

export const selectTimezoneOffset = (bundle: WeatherBundle): number => bundle.timezoneOffsetSeconds;
