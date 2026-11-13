import { describe, expect, it } from 'vitest';

import { EnvError, parseEnv } from './env';

const valid = {
  VITE_WEATHER_API_URL: 'https://weather.example.test/v1',
};

describe('parseEnv', () => {
  it('accepts a complete environment', () => {
    expect(parseEnv({ ...valid, VITE_VAPID_PUBLIC_KEY: 'abc' })).toEqual({
      ...valid,
      VITE_VAPID_PUBLIC_KEY: 'abc',
    });
  });

  it('treats an empty optional variable as unset', () => {
    expect(parseEnv({ ...valid, VITE_VAPID_PUBLIC_KEY: '' }).VITE_VAPID_PUBLIC_KEY).toBeUndefined();
  });

  it('names the missing variable in the error', () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({})).toThrow(/VITE_WEATHER_API_URL/);
  });

  it('rejects non-http URLs', () => {
    expect(() =>
      parseEnv({ ...valid, VITE_WEATHER_API_URL: 'ftp://weather.example.test' }),
    ).toThrow(/must be an http\(s\) URL/);
  });
});
