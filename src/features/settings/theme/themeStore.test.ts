import { afterEach, describe, expect, it } from 'vitest';

import { createThemeStore, THEME_STORAGE_KEY } from './themeStore';

/** A controllable prefers-color-scheme media query. */
function fakeMedia(initiallyDark: boolean) {
  let matches = initiallyDark;
  const listeners = new Set<() => void>();
  return {
    query: {
      get matches() {
        return matches;
      },
      addEventListener: (_: 'change', listener: () => void) => {
        listeners.add(listener);
      },
    },
    setDark(dark: boolean) {
      matches = dark;
      for (const listener of listeners) listener();
    },
  };
}

function setup(initiallyDark = false) {
  const root = document.createElement('html');
  const meta = document.createElement('meta');
  const media = fakeMedia(initiallyDark);
  const store = createThemeStore({
    root,
    matchMedia: () => media.query,
    meta: () => meta,
  });
  return { root, meta, media, store };
}

describe('theme store', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to system and follows the OS preference', () => {
    const { root, store } = setup(true);
    expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' });
    expect(root.hasAttribute('data-theme')).toBe(false); // CSS follows prefers-color-scheme
  });

  it('reacts to OS changes while on system, without touching data-theme', () => {
    const { root, meta, media, store } = setup(false);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    media.setDark(true);
    expect(store.getSnapshot().resolved).toBe('dark');
    expect(meta.getAttribute('content')).toBe('#17181d');
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(notified).toBe(1);
  });

  it('a forced theme ignores OS changes', () => {
    const { media, store } = setup(false);
    store.setPreference('light');
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    media.setDark(true);
    expect(store.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' });
    expect(notified).toBe(0);
  });

  it('applies and persists a choice', () => {
    const { root, store } = setup(false);
    store.setPreference('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('"dark"');

    store.setPreference('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('restores a saved choice and ignores a tampered one', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, '"dark"');
    expect(setup(false).store.getSnapshot().preference).toBe('dark');

    window.localStorage.setItem(THEME_STORAGE_KEY, '"neon"');
    expect(setup(false).store.getSnapshot().preference).toBe('system');
  });
});
