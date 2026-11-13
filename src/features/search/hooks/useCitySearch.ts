import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { CITY_QUERY_MIN } from '@/shared/api/cities-contract';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

import { searchCities } from '../api/searchCities';

export const SEARCH_DEBOUNCE_MS = 150;

/**
 * Debounced city search.
 * - Only fires for ≥ 2 characters (after trimming) and while the popup is open.
 * - Each new query aborts the previous request via TanStack Query's `signal`.
 * - `placeholderData: keepPreviousData` keeps the last results on screen while the next
 *   query loads, so the list never flashes empty mid-typing.
 * - No automatic retries: rate limits and network failures have their own UI
 *   (countdown / retry button), and retrying a 429 immediately only extends the limit.
 */
export function useCitySearch(rawQuery: string, enabled: boolean) {
  const query = useDebouncedValue(rawQuery.trim(), SEARCH_DEBOUNCE_MS);
  const isSearchable = query.length >= CITY_QUERY_MIN;

  const result = useQuery({
    // Lower-cased key: "Lis" and "lis" share one cache entry (GeoDB matching is case-insensitive).
    queryKey: ['cities', query.toLowerCase()],
    queryFn: ({ signal }) => searchCities(query, signal),
    enabled: enabled && isSearchable,
    staleTime: 10 * 60_000, // city data barely changes
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });

  return { ...result, query, isSearchable };
}
