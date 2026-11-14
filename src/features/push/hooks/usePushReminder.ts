import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

import type { City } from '@/shared/api/cities-contract';
import { getEnv } from '@/shared/lib/env';
import { readStorage, removeStorage, writeStorage } from '@/shared/lib/storage';

import { registerReminder, unregisterReminder } from '../api/pushWorker';
import { currentTimeZone, detectPushSupport, vapidKeyToBytes } from '../lib/support';

const SETTINGS_KEY = 'weatherboard:reminder:v1';
const SettingsSchema = z.object({
  reminderTime: z.string(),
  cityName: z.string(),
  endpoint: z.url(),
});
export type ReminderSettings = z.infer<typeof SettingsSchema>;

export type ReminderState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'ios-needs-install' }
  | { status: 'unsupported'; missing: string[] }
  | { status: 'denied' }
  | { status: 'off' }
  | { status: 'on'; settings: ReminderSettings };

export type EnableResult =
  { ok: true } | { ok: false; reason: 'denied' | 'dismissed' | 'error'; message?: string };

function initialState(): ReminderState {
  const env = getEnv();
  if (!env.VITE_PUSH_WORKER_URL || !env.VITE_VAPID_PUBLIC_KEY) return { status: 'not-configured' };
  const support = detectPushSupport();
  if (support.status !== 'supported') return support;
  if (Notification.permission === 'denied') return { status: 'denied' };
  return { status: 'loading' };
}

/**
 * Daily reminder lifecycle. The permission prompt is only ever triggered from `enable`,
 * i.e. after the user confirmed the explainer dialog — never on page load.
 */
export function usePushReminder() {
  const [state, setState] = useState<ReminderState>(initialState);

  // Reconcile with the browser once: a stored subscription may have been revoked.
  useEffect(() => {
    if (state.status !== 'loading') return;
    let cancelled = false;
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (cancelled) return;
        const settings = readStorage(SETTINGS_KEY, SettingsSchema);
        if (subscription && settings?.endpoint === subscription.endpoint) {
          setState({ status: 'on', settings });
        } else {
          if (settings) removeStorage(SETTINGS_KEY);
          setState({ status: 'off' });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'off' });
      });
    return () => {
      cancelled = true;
    };
  }, [state.status]);

  const enable = useCallback(async (reminderTime: string, city: City): Promise<EnableResult> => {
    const { VITE_PUSH_WORKER_URL: workerUrl, VITE_VAPID_PUBLIC_KEY: vapidKey } = getEnv();
    if (!workerUrl || !vapidKey) return { ok: false, reason: 'error' };

    // Only now, after the explainer was confirmed, does the browser ask.
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      setState({ status: 'denied' });
      return { ok: false, reason: 'denied' };
    }
    if (permission !== 'granted') return { ok: false, reason: 'dismissed' };

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyToBytes(vapidKey),
        }));
      await registerReminder(workerUrl, {
        subscription: subscription.toJSON(),
        reminderTime,
        timezone: currentTimeZone(),
        city: { name: city.name, lat: city.lat, lon: city.lon },
      });
      const settings = { reminderTime, cityName: city.name, endpoint: subscription.endpoint };
      writeStorage(SETTINGS_KEY, settings);
      setState({ status: 'on', settings });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: 'error',
        message: error instanceof Error ? error.message : 'Something unexpected failed.',
      };
    }
  }, []);

  const disable = useCallback(async (): Promise<void> => {
    const workerUrl = getEnv().VITE_PUSH_WORKER_URL;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Tell the worker first (best effort), then drop the browser subscription.
      if (workerUrl)
        await unregisterReminder(workerUrl, subscription.endpoint).catch(() => undefined);
      await subscription.unsubscribe();
    }
    removeStorage(SETTINGS_KEY);
    setState({ status: 'off' });
  }, []);

  return { state, enable, disable };
}
