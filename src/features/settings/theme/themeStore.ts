import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { readStorage, writeStorage } from '@/shared/lib/storage';

/** Must match public/theme-init.js, which applies it before first paint. */
export const THEME_STORAGE_KEY = 'weatherboard:theme:v1';

export const ThemePreferenceSchema = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeState {
  preference: ThemePreference;
  /** What is actually showing — for "system", whatever the OS currently prefers. */
  resolved: ResolvedTheme;
}

/** Browser chrome colour (meta theme-color) per resolved theme: the header surface. */
const CHROME_COLOR: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#17181d' };

export interface ThemeEnvironment {
  root: HTMLElement;
  /** Only what the store uses, so tests can pass a tiny fake. */
  matchMedia: (query: string) => {
    readonly matches: boolean;
    addEventListener: (type: 'change', listener: () => void) => void;
  };
  meta: () => HTMLMetaElement | null;
}

/**
 * Theme as an external store. Applying a theme is one attribute write on <html> (CSS tokens
 * do the rest), so switching never re-renders the app — only the switcher subscribes.
 */
export function createThemeStore(env: ThemeEnvironment) {
  const media = env.matchMedia('(prefers-color-scheme: dark)');
  const listeners = new Set<() => void>();
  const resolve = (preference: ThemePreference): ResolvedTheme =>
    preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;

  const initial = readStorage(THEME_STORAGE_KEY, ThemePreferenceSchema) ?? 'system';
  let state: ThemeState = { preference: initial, resolved: resolve(initial) };

  function apply() {
    if (state.preference === 'system') env.root.removeAttribute('data-theme');
    else env.root.setAttribute('data-theme', state.preference);
    env.meta()?.setAttribute('content', CHROME_COLOR[state.resolved]);
  }

  function update(next: ThemeState) {
    if (next.preference === state.preference && next.resolved === state.resolved) return;
    state = next;
    apply();
    for (const listener of listeners) listener();
  }

  // The OS preference can change while the app is open (e.g. sunset auto-switch).
  media.addEventListener('change', () => {
    update({ preference: state.preference, resolved: resolve(state.preference) });
  });

  apply();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    setPreference(preference: ThemePreference) {
      writeStorage(THEME_STORAGE_KEY, preference);
      update({ preference, resolved: resolve(preference) });
    },
  };
}

export type ThemeStore = ReturnType<typeof createThemeStore>;

let store: ThemeStore | null = null;
function getStore(): ThemeStore {
  store ??= createThemeStore({
    root: document.documentElement,
    matchMedia: (query) => window.matchMedia(query),
    meta: () => document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'),
  });
  return store;
}

const subscribe = (listener: () => void) => getStore().subscribe(listener);
const getSnapshot = () => getStore().getSnapshot();

export function useTheme(): ThemeState & { setPreference: (preference: ThemePreference) => void } {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...state,
    setPreference: (preference) => {
      getStore().setPreference(preference);
    },
  };
}
