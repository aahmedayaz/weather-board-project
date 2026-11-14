import { z } from 'zod';

import { CitySchema, type City } from '@/shared/api/cities-contract';

export const FAVORITES_STORAGE_KEY = 'weatherboard:favorites:v1';
export const MAX_FAVORITES = 5;

export interface FavoritesSnapshot {
  readonly cities: readonly City[];
  /** False when storage is unavailable: favourites live in memory for this tab only. */
  readonly persistent: boolean;
}

export type AddResult =
  { ok: true } | { ok: false; reason: 'limit' } | { ok: false; reason: 'duplicate' };

export interface FavoritesStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => FavoritesSnapshot;
  add: (city: City) => AddResult;
  remove: (cityId: number) => void;
  has: (city: City) => boolean;
}

/** Two entries are the same place if they share an id or sit within ~1 km. */
export function isSameCity(a: City, b: City): boolean {
  const round = (value: number) => Math.round(value * 100);
  return a.id === b.id || (round(a.lat) === round(b.lat) && round(a.lon) === round(b.lon));
}

function dedupe(cities: readonly City[]): City[] {
  const result: City[] = [];
  for (const city of cities) if (!result.some((kept) => isSameCity(kept, city))) result.push(city);
  return result;
}

const StoredFavoritesSchema = z.array(CitySchema);

/** Zod-validated read. Corrupt, tampered or over-long data is repaired or ignored. */
function parseStored(raw: string | null): City[] {
  if (raw === null) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  const parsed = StoredFavoritesSchema.safeParse(json);
  return parsed.success ? dedupe(parsed.data).slice(0, MAX_FAVORITES) : [];
}

export interface FavoritesStoreOptions {
  /** A working Storage, or null to start in memory-only mode. */
  storage: Storage | null;
  /** Window to listen on for cross-tab `storage` events (omit in non-browser tests). */
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  key?: string;
}

/**
 * Favourites as an external store for `useSyncExternalStore`.
 * - Reads are Zod-validated; writes go through try/catch.
 * - If storage is missing or a write throws (quota, private mode), the store keeps working in
 *   memory and reports `persistent: false` so the UI can say favourites won't survive.
 * - Other tabs' changes arrive through the `storage` event and are re-validated.
 * - `getSnapshot` returns the same object until something changes (required by
 *   useSyncExternalStore to avoid render loops).
 */
export function createFavoritesStore({
  storage,
  eventTarget,
  key = FAVORITES_STORAGE_KEY,
}: FavoritesStoreOptions): FavoritesStore {
  let activeStorage = storage;
  let snapshot: FavoritesSnapshot = {
    cities: activeStorage ? readFrom(activeStorage) : [],
    persistent: activeStorage !== null,
  };
  const listeners = new Set<() => void>();

  function readFrom(source: Storage): City[] {
    try {
      return parseStored(source.getItem(key));
    } catch {
      activeStorage = null;
      return [];
    }
  }

  function emit(next: FavoritesSnapshot) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function commit(cities: City[]) {
    let persistent = activeStorage !== null;
    if (activeStorage) {
      try {
        activeStorage.setItem(key, JSON.stringify(cities));
      } catch {
        activeStorage = null; // e.g. quota exceeded: keep going in memory
        persistent = false;
      }
    }
    emit({ cities, persistent });
  }

  function onStorageEvent(event: StorageEvent) {
    if (!activeStorage || (event.key !== key && event.key !== null)) return;
    const cities = parseStored(event.newValue);
    // Only emit (and re-render) when the list really differs; small lists, so compare JSON.
    if (JSON.stringify(cities) !== JSON.stringify(snapshot.cities)) {
      emit({ cities, persistent: snapshot.persistent });
    }
  }

  return {
    subscribe(listener) {
      if (listeners.size === 0) eventTarget?.addEventListener('storage', onStorageEvent);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) eventTarget?.removeEventListener('storage', onStorageEvent);
      };
    },
    getSnapshot: () => snapshot,
    has: (city) => snapshot.cities.some((saved) => isSameCity(saved, city)),
    add(city) {
      if (snapshot.cities.some((saved) => isSameCity(saved, city))) {
        return { ok: false, reason: 'duplicate' };
      }
      if (snapshot.cities.length >= MAX_FAVORITES) return { ok: false, reason: 'limit' };
      commit([...snapshot.cities, city]);
      return { ok: true };
    },
    remove(cityId) {
      if (!snapshot.cities.some((city) => city.id === cityId)) return;
      commit(snapshot.cities.filter((city) => city.id !== cityId));
    },
  };
}
