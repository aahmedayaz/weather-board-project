/**
 * GET /api/weather?lat=<-90..90>&lon=<-180..180> → WeatherBundle
 *
 * Primary: OpenWeatherMap (current + 5-day/3-hour forecast, metric).
 * Fallback: Open-Meteo, when OpenWeatherMap is rate limited (429), failing (5xx), unreachable,
 * returns something we can't parse, rejects the key (401/403), or has no key configured.
 * A genuine "no such place" (404) or bad request (400) is not retried elsewhere.
 * Both sources normalize into one WeatherBundle; `source` names the one that answered.
 */
import { z } from 'zod';

import type { ApiErrorCode, ApiErrorResponse } from '../../src/shared/api/api-error.js';
import { WeatherBundleSchema, type Coordinates } from '../../src/shared/api/weather-contract.js';

import type { UpstreamFailure } from './upstream.js';
import { fetchOpenMeteo } from './weather/open-meteo.js';
import { fetchOpenWeatherMap, type ProviderResult } from './weather/openweathermap.js';

/** Edge: fresh 10 min, then serve stale up to 30 min while revalidating. Browser: 1 min. */
export const WEATHER_CACHE_CONTROL =
  'public, max-age=60, s-maxage=600, stale-while-revalidate=1800';

const DEFAULT_RETRY_AFTER_SECONDS = 30;

/** A present, numeric query param within range. `Number('')` is 0, so require non-empty first. */
const coordinateParam = (limit: number) =>
  z.string().trim().min(1).transform(Number).pipe(z.number().min(-limit).max(limit));
const QuerySchema = z.object({ lat: coordinateParam(90), lon: coordinateParam(180) });

export interface WeatherHandlerDeps {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
}

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  retryAfterSeconds?: number,
): Response {
  const body: ApiErrorResponse = {
    error:
      retryAfterSeconds === undefined ? { code, message } : { code, message, retryAfterSeconds },
  };
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (retryAfterSeconds !== undefined) headers.set('Retry-After', String(retryAfterSeconds));
  return Response.json(body, { status, headers });
}

function shouldFallBack(failure: UpstreamFailure): boolean {
  if (failure.kind !== 'http') return true; // network, timeout, unparseable
  return (
    failure.status === 429 ||
    failure.status >= 500 ||
    failure.status === 401 ||
    failure.status === 403
  );
}

function failureResponse(failure: UpstreamFailure): Response {
  switch (failure.kind) {
    case 'network':
      return errorResponse(
        503,
        'UPSTREAM_UNAVAILABLE',
        'The weather service could not be reached.',
      );
    case 'invalid-response':
      return errorResponse(
        502,
        'UPSTREAM_ERROR',
        'The weather service returned an unexpected response.',
      );
    case 'http':
      if (failure.status === 429) {
        return errorResponse(
          429,
          'RATE_LIMITED',
          'Too many weather requests right now.',
          failure.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
        );
      }
      if (failure.status === 404) {
        return errorResponse(404, 'NOT_FOUND', 'No weather data exists for this location.');
      }
      if (failure.status === 400) {
        return errorResponse(400, 'INVALID_COORDINATES', 'These coordinates were rejected.');
      }
      return errorResponse(502, 'UPSTREAM_ERROR', 'The weather service is having problems.');
  }
}

function success(result: Extract<ProviderResult, { ok: true }>): Response {
  // Final guard: whatever the provider produced must match the public contract.
  const bundle = WeatherBundleSchema.parse(result.bundle);
  return Response.json(bundle, { headers: { 'Cache-Control': WEATHER_CACHE_CONTROL } });
}

export async function handleWeatherRequest(
  request: Request,
  { env, fetch: fetchImpl }: WeatherHandlerDeps,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = QuerySchema.safeParse({
    lat: params.get('lat') ?? '',
    lon: params.get('lon') ?? '',
  });
  if (!query.success) {
    return errorResponse(
      400,
      'INVALID_COORDINATES',
      'Provide lat between -90 and 90 and lon between -180 and 180.',
    );
  }
  const coordinates: Coordinates = query.data;

  const apiKey = env.OPENWEATHER_API_KEY;
  if (apiKey) {
    const primary = await fetchOpenWeatherMap(coordinates, apiKey, fetchImpl, request.signal);
    if (primary.ok) return success(primary);
    if (!shouldFallBack(primary.failure)) return failureResponse(primary.failure);
    console.warn('api/weather: OpenWeatherMap failed, falling back to Open-Meteo', primary.failure);
  } else {
    console.warn('api/weather: OPENWEATHER_API_KEY not set, using Open-Meteo');
  }

  const fallback = await fetchOpenMeteo(coordinates, fetchImpl, request.signal);
  if (fallback.ok) return success(fallback);
  console.error('api/weather: Open-Meteo failed too', fallback.failure);
  return failureResponse(fallback.failure);
}
