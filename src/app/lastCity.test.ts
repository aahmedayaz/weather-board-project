import { afterEach, describe, expect, it } from 'vitest';

import {
  coordinateCityId,
  DEFAULT_CITY,
  LAST_CITY_STORAGE_KEY,
  readCityFromUrl,
  readLastCity,
  saveLastCity,
} from './lastCity';

describe('city from a reminder link', () => {
  it('reads ?name=&lat=&lon= into a city with a stable, non-colliding id', () => {
    expect(readCityFromUrl('?name=Karachi&lat=24.86&lon=67')).toEqual({
      id: coordinateCityId(24.86, 67),
      name: 'Karachi',
      region: null,
      country: '',
      lat: 24.86,
      lon: 67,
    });
    expect(coordinateCityId(24.86, 67)).toBeLessThan(0);
    expect(coordinateCityId(24.86, 67)).not.toBe(coordinateCityId(24.86, 67.01));
  });

  it.each([
    ['nothing', ''],
    ['missing lon', '?name=Karachi&lat=24.86'],
    ['out-of-range lat', '?name=X&lat=95&lon=0'],
    ['non-numeric coordinates', '?name=X&lat=abc&lon=0'],
    ['an empty name', '?name=%20&lat=1&lon=1'],
  ])('ignores %s', (_, search) => {
    expect(readCityFromUrl(search)).toBeNull();
  });
});

const lisbon = {
  id: 1,
  name: 'Lisbon',
  region: 'Lisbon District',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.13,
};

describe('last viewed city', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to Karachi on a first visit', () => {
    expect(readLastCity()).toEqual(DEFAULT_CITY);
    expect(DEFAULT_CITY.name).toBe('Karachi');
  });

  it('remembers the last selected city', () => {
    saveLastCity(lisbon);
    expect(readLastCity()).toEqual(lisbon);
  });

  it('falls back to Karachi when the stored value was tampered with', () => {
    window.localStorage.setItem(
      LAST_CITY_STORAGE_KEY,
      JSON.stringify({ ...lisbon, lat: 'javascript:alert(1)' }),
    );
    expect(readLastCity()).toEqual(DEFAULT_CITY);
  });
});
