import * as webpush from 'web-push';

import type { PushSender, StoredSubscription } from './reminders';

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/** Push sender backed by `web-push` (verified to run in workerd under nodejs_compat). */
export function createWebPushSender(vapid: VapidConfig): PushSender {
  return {
    async send(subscription: StoredSubscription, payload: string) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          payload,
          {
            vapidDetails: vapid,
            TTL: 6 * 60 * 60, // a morning reminder is useless by the evening
            urgency: 'normal',
            topic: 'daily-forecast', // a newer reminder replaces an undelivered older one
          },
        );
        return { ok: true };
      } catch (error) {
        const status =
          typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          typeof error.statusCode === 'number'
            ? error.statusCode
            : undefined;
        // 404 Not Found / 410 Gone: the subscription no longer exists — delete it.
        return { ok: false, gone: status === 404 || status === 410, ...(status ? { status } : {}) };
      }
    },
  };
}
