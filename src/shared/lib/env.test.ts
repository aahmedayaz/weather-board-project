import { describe, expect, it } from 'vitest';

import { EnvError, parseEnv } from './env';

describe('parseEnv', () => {
  it('accepts an empty environment (every client variable is optional for now)', () => {
    expect(parseEnv({})).toEqual({});
  });

  const vapid =
    'BNw7SklzOGSUxWDKOM2vsYFrfwR2SjV6SbRb1H-e9UUYeAYcmnWk9x8CNkaVPk5ZcL9SMd6HKRTmI6BMY4GFGN0';

  it('keeps a provided VAPID key and push worker URL', () => {
    expect(
      parseEnv({ VITE_VAPID_PUBLIC_KEY: vapid, VITE_PUSH_WORKER_URL: 'https://push.example.test' }),
    ).toEqual({ VITE_VAPID_PUBLIC_KEY: vapid, VITE_PUSH_WORKER_URL: 'https://push.example.test' });
  });

  it('rejects a malformed VAPID key or worker URL', () => {
    expect(() => parseEnv({ VITE_VAPID_PUBLIC_KEY: 'abc' })).toThrow(/VITE_VAPID_PUBLIC_KEY/);
    expect(() => parseEnv({ VITE_PUSH_WORKER_URL: 'ftp://x' })).toThrow(/VITE_PUSH_WORKER_URL/);
  });

  it('treats an empty optional variable as unset', () => {
    expect(parseEnv({ VITE_VAPID_PUBLIC_KEY: '' }).VITE_VAPID_PUBLIC_KEY).toBeUndefined();
  });

  it('names the offending variable in the error', () => {
    expect(() => parseEnv({ VITE_VAPID_PUBLIC_KEY: 42 })).toThrow(EnvError);
    expect(() => parseEnv({ VITE_VAPID_PUBLIC_KEY: 42 })).toThrow(/VITE_VAPID_PUBLIC_KEY/);
  });
});
