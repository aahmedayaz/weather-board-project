/**
 * GET /api/cities?q=<prefix> → { cities: City[] }
 *
 * Proxies GeoDB Cities (RapidAPI). The RapidAPI key stays on the server; the response is
 * trimmed to the fields the UI needs and cached at the edge. Every failure is a typed JSON
 * error (see ApiErrorResponse) — the client never sees an upstream payload or stack trace.
 *
 * Lives in `_lib/` (underscore = not a route) and takes its env + fetch as arguments, so it
 * can be unit-tested and reused by the Vite dev server.
 */
import { z } from 'zod';

import {
  CityQuerySchema,
  type ApiErrorCode,
  type ApiErrorResponse,
  type CitiesResponse,
} from '../../src/shared/api/cities-contract.js';

const UPSTREAM_TIMEOUT_MS = 5_000;
const RESULT_LIMIT = 8;
const DEFAULT_RETRY_AFTER_SECONDS = 2; // GeoDB's free tier allows ~1 request/second

/** Success: edge caches 1 day and serves stale for a week while revalidating; browsers 5 min. */
export const SUCCESS_CACHE_CONTROL =
  'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';

const ServerEnvSchema = z.object({
  RAPIDAPI_KEY: z.string().min(1),
  GEODB_API_HOST: z.string().min(1).default('wft-geo-db.p.rapidapi.com'),
});

/** Only the upstream fields we use; everything else is dropped. */
const GeoDbResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      region: z.string().nullish(),
      country: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    }),
  ),
});

export interface CitiesHandlerDeps {
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

function parseRetryAfter(header: string | null): number {
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_RETRY_AFTER_SECONDS;
  return Math.min(Math.ceil(seconds), 60);
}

export async function handleCitiesRequest(
  request: Request,
  { env, fetch: fetchImpl }: CitiesHandlerDeps,
): Promise<Response> {
  const query = CityQuerySchema.safeParse(new URL(request.url).searchParams.get('q') ?? '');
  if (!query.success) {
    return errorResponse(
      400,
      'INVALID_QUERY',
      query.error.issues[0]?.message ?? 'Invalid search query.',
    );
  }

  const serverEnv = ServerEnvSchema.safeParse(env);
  if (!serverEnv.success) {
    console.error('api/cities: RAPIDAPI_KEY is not configured');
    return errorResponse(500, 'SERVER_MISCONFIGURED', 'City search is not configured.');
  }

  const upstreamUrl = new URL(`https://${serverEnv.data.GEODB_API_HOST}/v1/geo/cities`);
  upstreamUrl.search = new URLSearchParams({
    namePrefix: query.data,
    limit: String(RESULT_LIMIT),
    sort: '-population',
    types: 'CITY',
    languageCode: 'en',
  }).toString();

  let upstream: Response;
  try {
    upstream = await fetchImpl(upstreamUrl, {
      headers: {
        'X-RapidAPI-Key': serverEnv.data.RAPIDAPI_KEY,
        'X-RapidAPI-Host': serverEnv.data.GEODB_API_HOST,
      },
      // Stop on our own timeout, or as soon as the browser gives up on this request.
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
    });
  } catch {
    return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'City search could not be reached.');
  }

  if (upstream.status === 429) {
    const retryAfter = parseRetryAfter(upstream.headers.get('Retry-After'));
    return errorResponse(429, 'RATE_LIMITED', 'Too many searches right now.', retryAfter);
  }
  if (!upstream.ok) {
    console.error(`api/cities: upstream responded ${String(upstream.status)}`);
    return errorResponse(502, 'UPSTREAM_ERROR', 'City search is temporarily unavailable.');
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return errorResponse(502, 'UPSTREAM_ERROR', 'City search returned an unreadable response.');
  }
  const parsed = GeoDbResponseSchema.safeParse(payload);
  if (!parsed.success) {
    console.error('api/cities: unexpected upstream shape', z.prettifyError(parsed.error));
    return errorResponse(502, 'UPSTREAM_ERROR', 'City search returned an unexpected response.');
  }

  const body: CitiesResponse = {
    cities: parsed.data.data.map((city) => ({
      id: city.id,
      name: city.name,
      region: city.region ?? null,
      country: city.country,
      lat: city.latitude,
      lon: city.longitude,
    })),
  };
  return Response.json(body, { headers: { 'Cache-Control': SUCCESS_CACHE_CONTROL } });
}
