import {
  ApiErrorResponseSchema,
  CitiesResponseSchema,
  type City,
} from '@/shared/api/cities-contract';

export type CitySearchErrorKind = 'rate-limited' | 'network' | 'unavailable';

/** Typed failure the UI switches on. `retryAfterSeconds` is set for 'rate-limited'. */
export class CitySearchError extends Error {
  override name = 'CitySearchError';
  readonly kind: CitySearchErrorKind;
  readonly retryAfterSeconds: number;

  constructor(kind: CitySearchErrorKind, message: string, retryAfterSeconds = 0) {
    super(message);
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const DEFAULT_RETRY_AFTER_SECONDS = 2;

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Calls our /api/cities proxy. Validates both success and error bodies with Zod, and turns
 * every failure into a CitySearchError. Aborts (superseded keystrokes) are rethrown as-is so
 * TanStack Query can discard them silently.
 */
export async function searchCities(query: string, signal: AbortSignal): Promise<City[]> {
  let response: Response;
  try {
    response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new CitySearchError('network', 'Network request failed.');
  }

  const body = await readJson(response);

  if (response.ok) {
    const parsed = CitiesResponseSchema.safeParse(body);
    if (!parsed.success) throw new CitySearchError('unavailable', 'Unexpected response shape.');
    return parsed.data.cities;
  }

  const apiError = ApiErrorResponseSchema.safeParse(body);
  if (response.status === 429) {
    const retryAfter =
      (apiError.success ? apiError.data.error.retryAfterSeconds : undefined) ??
      DEFAULT_RETRY_AFTER_SECONDS;
    throw new CitySearchError('rate-limited', 'Rate limited.', retryAfter);
  }
  throw new CitySearchError(
    'unavailable',
    apiError.success ? apiError.data.error.message : `HTTP ${String(response.status)}`,
  );
}
