import { useSyncExternalStore } from 'react';

import { getWorkingStorage } from '@/shared/lib/storage';

import {
  createFavoritesStore,
  type FavoritesSnapshot,
  type FavoritesStore,
} from './favoritesStore';

let store: FavoritesStore | null = null;

/** The app-wide store, created on first use (so tests and SSR never touch storage early). */
export function getFavoritesStore(): FavoritesStore {
  store ??= createFavoritesStore({ storage: getWorkingStorage(), eventTarget: window });
  return store;
}

const subscribe = (listener: () => void) => getFavoritesStore().subscribe(listener);
const getSnapshot = () => getFavoritesStore().getSnapshot();

/** Current favourites; re-renders only when the list or the persistence mode changes. */
export function useFavorites(): FavoritesSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
