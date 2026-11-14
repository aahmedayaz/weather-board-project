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
