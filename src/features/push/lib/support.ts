export type PushSupport =
  | { status: 'supported' }
  /** iPhone/iPad: Web Push exists only for a PWA added to the Home Screen (iOS 16.4+). */
  | { status: 'ios-needs-install' }
  | { status: 'unsupported'; missing: string[] };

export interface SupportEnvironment {
  window: { matchMedia: (query: string) => { matches: boolean } } & Partial<
    Record<'PushManager' | 'Notification', unknown>
  >;
  navigator: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & {
    serviceWorker?: unknown;
    standalone?: boolean;
  };
}

function isIos({ navigator }: SupportEnvironment): boolean {
  // iPadOS reports as "Macintosh" — touch support gives it away.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  );
}

function isInstalled({ window, navigator }: SupportEnvironment): boolean {
  return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/** Feature-detects everything the reminder flow needs. Pure: the environment is passed in. */
export function detectPushSupport(
  environment: SupportEnvironment = { window, navigator },
): PushSupport {
  if (isIos(environment) && !isInstalled(environment)) return { status: 'ios-needs-install' };

  const missing: string[] = [];
  if (!('serviceWorker' in environment.navigator)) missing.push('service workers');
  if (!('PushManager' in environment.window)) missing.push('the Push API');
  if (!('Notification' in environment.window)) missing.push('notifications');
  return missing.length === 0 ? { status: 'supported' } : { status: 'unsupported', missing };
}

/** VAPID public key (base64url) → the bytes `pushManager.subscribe` expects. */
export function vapidKeyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** The viewer's IANA zone, e.g. "Asia/Karachi" — reminders fire in local time. */
export const currentTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
