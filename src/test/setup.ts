import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout engine, so it doesn't implement scrollIntoView.
// (Guarded: files marked `@vitest-environment node` share this setup and have no DOM.)
if ('Element' in globalThis) {
  Element.prototype.scrollIntoView = () => undefined;
}

// Vitest globals are off, so React Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});
