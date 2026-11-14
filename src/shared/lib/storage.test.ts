import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { readStorage, removeStorage, writeStorage } from './storage';

const KEY = 'test:city';
const CitySchema = z.object({ name: z.string(), lat: z.number().min(-90).max(90) });

describe('storage', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a valid value', () => {
    expect(writeStorage(KEY, { name: 'Lisbon', lat: 38.7 })).toBe(true);
    expect(readStorage(KEY, CitySchema)).toEqual({ name: 'Lisbon', lat: 38.7 });
  });

  it('returns null when nothing is stored', () => {
    expect(readStorage(KEY, CitySchema)).toBeNull();
  });

  it('ignores and removes malformed JSON', () => {
    window.localStorage.setItem(KEY, '{not json');
    expect(readStorage(KEY, CitySchema)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it.each([
    ['wrong type', { name: 42, lat: 38.7 }],
    ['out-of-range value', { name: 'Lisbon', lat: 900 }],
    ['missing field', { name: 'Lisbon' }],
    ['a different shape entirely', ['<script>alert(1)</script>']],
  ])('ignores and removes a tampered value (%s)', (_, tampered) => {
    window.localStorage.setItem(KEY, JSON.stringify(tampered));
    expect(readStorage(KEY, CitySchema)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('strips unknown extra fields', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ name: 'Lisbon', lat: 38.7, admin: true }));
    expect(readStorage(KEY, CitySchema)).toEqual({ name: 'Lisbon', lat: 38.7 });
  });

  it('returns null instead of throwing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readStorage(KEY, CitySchema)).toBeNull();
  });

  it('reports failure instead of throwing when the quota is exceeded', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(writeStorage(KEY, { name: 'Lisbon', lat: 38.7 })).toBe(false);
  });

  it('removeStorage never throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('nope');
    });
    expect(() => {
      removeStorage(KEY);
    }).not.toThrow();
  });
});
