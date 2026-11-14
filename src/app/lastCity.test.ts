import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_CITY, LAST_CITY_STORAGE_KEY, readLastCity, saveLastCity } from './lastCity';

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
