import { describe, expect, it } from 'vitest';

import { WeatherError } from './fetchWeather';
import {
  FOCUS_REFETCH_THROTTLE_MS,
  roundCoordinate,
  shouldRefetchOnFocus,
  shouldRetryWeather,
  weatherQueryOptions,
  weatherRetryDelay,
} from './weatherQuery';

describe('retry policy', () => {
  it.each(['rate-limited', 'not-found', 'offline'] as const)('never retries %s', (kind) => {
    expect(shouldRetryWeather(0, new WeatherError(kind, 'x'))).toBe(false);
  });

  it('retries server errors up to 3 times', () => {
    const error = new WeatherError('server', 'x', 502);
    expect([0, 1, 2, 3].map((count) => shouldRetryWeather(count, error))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('does not retry unknown errors', () => {
    expect(shouldRetryWeather(0, new Error('?'))).toBe(false);
  });

  it('backs off exponentially, capped at 8 s', () => {
    expect([0, 1, 2, 3, 4].map(weatherRetryDelay)).toEqual([1000, 2000, 4000, 8000, 8000]);
  });
});

describe('focus refetch throttle', () => {
  const now = 1_000_000_000;

  it('blocks a focus refetch within 60 s of the last success', () => {
    expect(shouldRefetchOnFocus({ dataUpdatedAt: now - 5_000, errorUpdatedAt: 0 }, now)).toBe(
      false,
    );
  });

  it('blocks a focus refetch within 60 s of the last failure (the case staleTime cannot cover)', () => {
    expect(
      shouldRefetchOnFocus({ dataUpdatedAt: now - 3_600_000, errorUpdatedAt: now - 10_000 }, now),
    ).toBe(false);
  });

  it('allows it once the last attempt is at least 60 s old', () => {
    expect(
      shouldRefetchOnFocus(
        { dataUpdatedAt: now - FOCUS_REFETCH_THROTTLE_MS, errorUpdatedAt: 0 },
        now,
      ),
    ).toBe(true);
  });
});

describe('weatherQueryOptions', () => {
  it('keys by rounded lat/lon so nearby points share a cache entry', () => {
    expect(weatherQueryOptions({ lat: 24.86071, lon: 67.00113 }).queryKey).toEqual([
      'weather',
      24.86,
      67,
    ]);
    expect(roundCoordinate(-9.13394)).toBe(-9.13);
  });

  it('keeps data fresh for 10 minutes', () => {
    expect(weatherQueryOptions({ lat: 0, lon: 0 }).staleTime).toBe(600_000);
  });
});
