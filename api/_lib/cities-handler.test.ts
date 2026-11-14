// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  ApiErrorResponseSchema,
  CitiesResponseSchema,
} from '../../src/shared/api/cities-contract.js';

import { handleCitiesRequest, SUCCESS_CACHE_CONTROL } from './cities-handler.js';

const env = { RAPIDAPI_KEY: 'test-key' };

const geoDbLisbon = {
  data: [
    {
      id: 1,
      wikiDataId: 'Q597',
      type: 'CITY',
      name: 'Lisbon',
      region: 'Lisbon District',
      country: 'Portugal',
      countryCode: 'PT',
      latitude: 38.7166,
      longitude: -9.1333,
      population: 545923,
    },
  ],
  metadata: { currentOffset: 0, totalCount: 1 },
};

function request(q: string | null) {
  const url = new URL('https://weatherboard.test/api/cities');
  if (q !== null) url.searchParams.set('q', q);
  return new Request(url);
}

async function errorOf(response: Response) {
  return ApiErrorResponseSchema.parse(await response.json()).error;
}

describe('GET /api/cities', () => {
  it.each([
    ['missing', null],
    ['too short after trimming', '  a  '],
    ['too long', 'x'.repeat(61)],
  ])('rejects a %s query with 400 INVALID_QUERY and never calls upstream', async (_, q) => {
    const fetchMock = vi.fn<typeof fetch>();
    const response = await handleCitiesRequest(request(q), { env, fetch: fetchMock });
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe('INVALID_QUERY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls GeoDB with the trimmed query and server-only key, returning only UI fields', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(geoDbLisbon));
    const response = await handleCitiesRequest(request('  lis  '), { env, fetch: fetchMock });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(SUCCESS_CACHE_CONTROL);
    expect(CitiesResponseSchema.parse(await response.json())).toEqual({
      cities: [
        {
          id: 1,
          name: 'Lisbon',
          region: 'Lisbon District',
          country: 'Portugal',
          lat: 38.7166,
          lon: -9.1333,
        },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url instanceof URL && url.searchParams.get('namePrefix')).toBe('lis');
    expect(new Headers(init?.headers).get('X-RapidAPI-Key')).toBe('test-key');
  });

  it('accepts a missing region', async () => {
    const { region: _, ...withoutRegion } = geoDbLisbon.data[0] ?? {};
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [withoutRegion] }));
    const body = CitiesResponseSchema.parse(
      await (await handleCitiesRequest(request('lis'), { env, fetch: fetchMock })).json(),
    );
    expect(body.cities[0]?.region).toBeNull();
  });

  it('maps upstream 429 to RATE_LIMITED with retryAfterSeconds and Retry-After', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('slow down', { status: 429, headers: { 'Retry-After': '3' } }),
      );
    const response = await handleCitiesRequest(request('lis'), { env, fetch: fetchMock });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await errorOf(response)).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 3 });
  });

  it('defaults retryAfterSeconds when upstream sends no Retry-After', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 }));
    const response = await handleCitiesRequest(request('lis'), { env, fetch: fetchMock });
    expect((await errorOf(response)).retryAfterSeconds).toBe(2);
  });

  it.each([500, 502, 503])('maps upstream %i to 502 UPSTREAM_ERROR', async (status) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('boom', { status }));
    const response = await handleCitiesRequest(request('lis'), { env, fetch: fetchMock });
    expect(response.status).toBe(502);
    expect((await errorOf(response)).code).toBe('UPSTREAM_ERROR');
  });

  it('maps an unexpected upstream payload to 502 UPSTREAM_ERROR', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: 'nope' }));
    const response = await handleCitiesRequest(request('lis'), { env, fetch: fetchMock });
    expect(response.status).toBe(502);
    expect((await errorOf(response)).code).toBe('UPSTREAM_ERROR');
  });

  it('maps a network failure or timeout to 503 UPSTREAM_UNAVAILABLE', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    const response = await handleCitiesRequest(request('lis'), { env, fetch: fetchMock });
    expect(response.status).toBe(503);
    expect((await errorOf(response)).code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('returns 500 SERVER_MISCONFIGURED without the key, and never leaks it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn<typeof fetch>();
    const response = await handleCitiesRequest(request('lis'), { env: {}, fetch: fetchMock });
    expect(response.status).toBe(500);
    expect((await errorOf(response)).code).toBe('SERVER_MISCONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
