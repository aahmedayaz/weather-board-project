import { describe, expect, it } from 'vitest';

import { ReminderTimeSchema } from './reminderTime';
import { detectPushSupport, vapidKeyToBytes, type SupportEnvironment } from './support';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/142 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

function environment({
  userAgent = ANDROID_CHROME,
  touchPoints = 5,
  standalone = false,
  serviceWorker = true,
  pushManager = true,
  notification = true,
}: Partial<{
  userAgent: string;
  touchPoints: number;
  standalone: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
}> = {}): SupportEnvironment {
  return {
    window: {
      matchMedia: (query: string) => ({ matches: standalone && query.includes('standalone') }),
      ...(pushManager ? { PushManager: {} } : {}),
      ...(notification ? { Notification: {} } : {}),
    },
    navigator: {
      userAgent,
      maxTouchPoints: touchPoints,
      ...(serviceWorker ? { serviceWorker: {} } : {}),
    },
  };
}

describe('detectPushSupport', () => {
  it('is supported when service workers, Push API and notifications all exist', () => {
    expect(detectPushSupport(environment())).toEqual({ status: 'supported' });
  });

  it('lists exactly what is missing', () => {
    expect(detectPushSupport(environment({ pushManager: false, notification: false }))).toEqual({
      status: 'unsupported',
      missing: ['the Push API', 'notifications'],
    });
    expect(detectPushSupport(environment({ serviceWorker: false }))).toEqual({
      status: 'unsupported',
      missing: ['service workers'],
    });
  });

  it('asks iPhone users to install the PWA first', () => {
    expect(detectPushSupport(environment({ userAgent: IPHONE }))).toEqual({
      status: 'ios-needs-install',
    });
  });

  it('recognises iPadOS in desktop mode (Macintosh UA + touch)', () => {
    expect(detectPushSupport(environment({ userAgent: IPAD_DESKTOP_MODE }))).toEqual({
      status: 'ios-needs-install',
    });
    expect(
      detectPushSupport(environment({ userAgent: IPAD_DESKTOP_MODE, touchPoints: 0 })),
    ).toEqual({
      status: 'supported',
    }); // a real Mac
  });

  it('supports the installed PWA on iOS', () => {
    expect(detectPushSupport(environment({ userAgent: IPHONE, standalone: true }))).toEqual({
      status: 'supported',
    });
  });
});

describe('vapidKeyToBytes', () => {
  it('decodes a base64url P-256 public key to 65 bytes starting with 0x04', () => {
    const bytes = vapidKeyToBytes(
      'BNw7SklzOGSUxWDKOM2vsYFrfwR2SjV6SbRb1H-e9UUYeAYcmnWk9x8CNkaVPk5ZcL9SMd6HKRTmI6BMY4GFGN0',
    );
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(0x04); // uncompressed point
  });
});

describe('ReminderTimeSchema', () => {
  it.each(['00:00', '07:30', '07:35', '23:55'])('accepts %s', (time) => {
    expect(ReminderTimeSchema.safeParse(time).success).toBe(true);
  });

  it.each([
    ['', 'Choose a time for your reminder.'],
    ['7:30', 'Enter a time like 07:30.'],
    ['24:00', 'Enter a time like 07:30.'],
    ['07:32', 'Choose a time in 5-minute steps, like 07:30 or 07:35.'],
  ])('rejects "%s" with a specific message', (time, message) => {
    const result = ReminderTimeSchema.safeParse(time);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
