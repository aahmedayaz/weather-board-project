import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Coordinates } from '@/shared/api/weather-contract';

import { weatherQueryCore } from './weatherQuery';

/**
 * Returns a stable callback that warms the weather cache for a location (e.g. on hover or
 * keyboard focus of a favourite). Uses the same options as the real query, so it respects
 * the 10-minute staleTime: fresh data is never refetched, and the click then renders
 * instantly from cache.
 */
export function usePrefetchWeather(): (coordinates: Coordinates) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (coordinates: Coordinates) => {
      // `query` replaces the deprecated prefetchQuery: returns cached data while fresh,
      // otherwise fetches once. A failed prefetch is harmless — the real query reports it.
      queryClient.query(weatherQueryCore(coordinates)).catch(() => undefined);
    },
    [queryClient],
  );
}
