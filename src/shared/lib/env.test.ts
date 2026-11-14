import { describe, expect, it } from 'vitest';

import { EnvError, parseEnv } from './env';

describe('parseEnv', () => {
  it('accepts an empty environment (every client variable is optional for now)', () => {
    expect(parseEnv({})).toEqual({});
  });

  it('keeps a provided VAPID key', () => {
    expect(parseEnv({ VITE_VAPID_PUBLIC_KEY: 'abc' })).toEqual({ VITE_VAPID_PUBLIC_KEY: 'abc' });
  });

  it('treats an empty optional variable as unset', () => {
    expect(parseEnv({ VITE_VAPID_PUBLIC_KEY: '' }).VITE_VAPID_PUBLIC_KEY).toBeUndefined();
  });

  it('names the offending variable in the error', () => {
    expect(() => parseEnv({ VITE_VAPID_PUBLIC_KEY: 42 })).toThrow(EnvError);
    expect(() => parseEnv({ VITE_VAPID_PUBLIC_KEY: 42 })).toThrow(/VITE_VAPID_PUBLIC_KEY/);
  });
});
