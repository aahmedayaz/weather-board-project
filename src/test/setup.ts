import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout engine, so it doesn't implement scrollIntoView.
// (Guarded: files marked `@vitest-environment node` share this setup and have no DOM.)
if ('Element' in globalThis) {
  Element.prototype.scrollIntoView = () => undefined;
}

// jsdom has no matchMedia; every real browser does. Default: light, no reduced motion.
// (jsdom never implements it, so define it whenever a DOM exists.)
if ('window' in globalThis) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// Vitest globals are off, so React Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});
