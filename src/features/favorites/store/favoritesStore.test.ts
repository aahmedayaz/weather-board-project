import { afterEach, describe, expect, it, vi } from 'vitest';

import type { City } from '@/shared/api/cities-contract';

import {
  createFavoritesStore,
  FAVORITES_STORAGE_KEY,
  MAX_FAVORITES,
  type FavoritesStore,
} from './favoritesStore';

const city = (id: number, lat = id, lon = id): City => ({
  id,
  name: `City ${String(id)}`,
  region: null,
  country: 'Testland',
  lat,
  lon,
});

const stored = () => window.localStorage.getItem(FAVORITES_STORAGE_KEY);
const fill = (store: FavoritesStore, count: number) => {
  for (let id = 1; id <= count; id += 1) store.add(city(id));
};

describe('favourites store', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('adds, persists and removes favourites', () => {
    const store = createFavoritesStore({ storage: window.localStorage });
    expect(store.add(city(1))).toEqual({ ok: true });
    expect(store.getSnapshot().cities.map((saved) => saved.id)).toEqual([1]);
    expect(JSON.parse(stored() ?? '[]')).toEqual([city(1)]);

    store.remove(1);
    expect(store.getSnapshot().cities).toEqual([]);
    expect(stored()).toBe('[]');
  });

  it('loads favourites saved by an earlier session', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([city(7)]));
    expect(createFavoritesStore({ storage: window.localStorage }).getSnapshot().cities).toEqual([
      city(7),
    ]);
  });

  describe('limit', () => {
    it(`allows at most ${String(MAX_FAVORITES)} cities and says why the next one failed`, () => {
      const store = createFavoritesStore({ storage: window.localStorage });
      fill(store, MAX_FAVORITES);
      expect(store.add(city(6))).toEqual({ ok: false, reason: 'limit' });
      expect(store.getSnapshot().cities).toHaveLength(MAX_FAVORITES);
    });

    it('frees a slot after a removal', () => {
      const store = createFavoritesStore({ storage: window.localStorage });
      fill(store, MAX_FAVORITES);
      store.remove(3);
      expect(store.add(city(6))).toEqual({ ok: true });
    });

    it('truncates an over-long stored list instead of exceeding the limit', () => {
      const seven = Array.from({ length: 7 }, (_, index) => city(index + 1));
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(seven));
      const store = createFavoritesStore({ storage: window.localStorage });
      expect(store.getSnapshot().cities).toHaveLength(MAX_FAVORITES);
    });
  });

  describe('duplicates', () => {
    it('rejects the same city id', () => {
      const store = createFavoritesStore({ storage: window.localStorage });
      store.add(city(1));
      expect(store.add(city(1))).toEqual({ ok: false, reason: 'duplicate' });
      expect(store.getSnapshot().cities).toHaveLength(1);
    });

    it('rejects the same place under a different id (within ~1 km)', () => {
      const store = createFavoritesStore({ storage: window.localStorage });
      store.add(city(1, 24.8607, 67.0011));
      expect(store.add(city(99, 24.8611, 67.0009))).toEqual({ ok: false, reason: 'duplicate' });
      expect(store.has(city(99, 24.8611, 67.0009))).toBe(true);
    });

    it('drops duplicates found in stored data', () => {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([city(1), city(1)]));
      expect(createFavoritesStore({ storage: window.localStorage }).getSnapshot().cities).toEqual([
        city(1),
      ]);
    });
  });

  describe('corrupted data', () => {
    it.each([
      ['malformed JSON', '{oops'],
      ['wrong shape', JSON.stringify({ cities: [] })],
      ['invalid entries', JSON.stringify([{ id: 'x', name: 1 }])],
      ['out-of-range coordinates', JSON.stringify([{ ...city(1), lat: 500 }])],
    ])('starts empty on %s and keeps working', (_, raw) => {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, raw);
      const store = createFavoritesStore({ storage: window.localStorage });
      expect(store.getSnapshot()).toEqual({ cities: [], persistent: true });
      expect(store.add(city(1))).toEqual({ ok: true });
      expect(JSON.parse(stored() ?? '[]')).toEqual([city(1)]);
    });
  });

  describe('storage disabled', () => {
    it('falls back to memory when no storage is available', () => {
      const store = createFavoritesStore({ storage: null });
      expect(store.getSnapshot().persistent).toBe(false);
      expect(store.add(city(1))).toEqual({ ok: true });
      expect(store.getSnapshot().cities).toEqual([city(1)]);
    });

    it('falls back to memory when reading throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      const store = createFavoritesStore({ storage: window.localStorage });
      expect(store.getSnapshot()).toEqual({ cities: [], persistent: false });
      expect(store.add(city(1))).toEqual({ ok: true });
    });

    it('switches to memory, without losing the change, when a write throws', () => {
      const store = createFavoritesStore({ storage: window.localStorage });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      expect(store.add(city(1))).toEqual({ ok: true });
      expect(store.getSnapshot()).toEqual({ cities: [city(1)], persistent: false });
    });
  });

  describe('subscriptions and cross-tab sync', () => {
    it('keeps the same snapshot object until something changes', () => {
      const store = createFavoritesStore({ storage: window.localStorage });
      const first = store.getSnapshot();
      expect(store.getSnapshot()).toBe(first);
      store.add(city(1, 1, 1));
      expect(store.add(city(1))).toMatchObject({ ok: false }); // rejected: no new snapshot
      const second = store.getSnapshot();
      expect(second).not.toBe(first);
      expect(store.getSnapshot()).toBe(second);
    });

    it('notifies subscribers on change and stops after unsubscribe', () => {
      const store = createFavoritesStore({ storage: window.localStorage });
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      store.add(city(1));
      expect(listener).toHaveBeenCalledOnce();
      unsubscribe();
      store.add(city(2));
      expect(listener).toHaveBeenCalledOnce();
    });

    it('picks up changes made in another tab', () => {
      const store = createFavoritesStore({ storage: window.localStorage, eventTarget: window });
      const listener = vi.fn();
      store.subscribe(listener);

      const otherTabValue = JSON.stringify([city(4), city(5)]);
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, otherTabValue);
      window.dispatchEvent(
        new StorageEvent('storage', { key: FAVORITES_STORAGE_KEY, newValue: otherTabValue }),
      );

      expect(listener).toHaveBeenCalledOnce();
      expect(store.getSnapshot().cities.map((saved) => saved.id)).toEqual([4, 5]);
    });

    it('ignores corrupted data from another tab and unrelated keys', () => {
      const store = createFavoritesStore({ storage: window.localStorage, eventTarget: window });
      store.add(city(1));
      const listener = vi.fn();
      store.subscribe(listener);

      window.dispatchEvent(new StorageEvent('storage', { key: 'something-else', newValue: '[]' }));
      window.dispatchEvent(
        new StorageEvent('storage', { key: FAVORITES_STORAGE_KEY, newValue: '{oops' }),
      );
      // Corrupt data reads as an empty list — the user cleared it elsewhere or it is garbage;
      // either way this tab must not crash, and it re-validates rather than trusting it.
      expect(store.getSnapshot().cities).toEqual([]);
      expect(listener).toHaveBeenCalledOnce();
    });
  });
});
