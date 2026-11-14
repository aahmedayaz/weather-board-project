import { z } from 'zod';

import { CitySchema, type City } from '@/shared/api/cities-contract';
import { readStorage, writeStorage } from '@/shared/lib/storage';

/** Versioned key: if the City shape ever changes, bump it and old values are simply ignored. */
export const LAST_CITY_STORAGE_KEY = 'weatherboard:last-city:v1';

/**
 * Shown on first visit, or when the stored city is missing, blocked or tampered with.
 * A configuration default, not mock data: real coordinates, live weather.
 * `id` is not a GeoDB id — it is only used as a list key.
 */
export const DEFAULT_CITY: City = {
  id: 0,
  name: 'Karachi',
  region: 'Sindh',
  country: 'Pakistan',
  lat: 24.8607,
  lon: 67.0011,
};

export function readLastCity(): City {
  return readStorage(LAST_CITY_STORAGE_KEY, CitySchema) ?? DEFAULT_CITY;
}

export function saveLastCity(city: City): void {
  writeStorage(LAST_CITY_STORAGE_KEY, city);
}

/** `?name=Karachi&lat=24.86&lon=67` — what a reminder notification links to. */
const CityParamsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  lat: z.string().trim().min(1).transform(Number).pipe(z.number().min(-90).max(90)),
  lon: z.string().trim().min(1).transform(Number).pipe(z.number().min(-180).max(180)),
});

/**
 * Stable negative id for a place known only by coordinates (~1 km grid), so it can't
 * collide with GeoDB ids (positive) or the default city (0).
 */
export const coordinateCityId = (lat: number, lon: number) =>
  -(Math.round((lat + 90) * 100) * 100_000 + Math.round((lon + 180) * 100) + 1);

export function readCityFromUrl(search: string): City | null {
  const params = new URLSearchParams(search);
  const parsed = CityParamsSchema.safeParse({
    name: params.get('name') ?? '',
    lat: params.get('lat') ?? '',
    lon: params.get('lon') ?? '',
  });
  if (!parsed.success) return null;
  const { name, lat, lon } = parsed.data;
  return { id: coordinateCityId(lat, lon), name, region: null, country: '', lat, lon };
}

/**
 * Startup city: a valid city in the URL (opened from a reminder) wins and becomes the
 * remembered city; the URL is then cleaned. Otherwise the last viewed city, else Karachi.
 * Call once, before the first render.
 */
export function resolveInitialCity(location: Location = window.location): City {
  const fromUrl = readCityFromUrl(location.search);
  if (!fromUrl) return readLastCity();
  saveLastCity(fromUrl);
  window.history.replaceState(null, '', location.pathname);
  return fromUrl;
}
