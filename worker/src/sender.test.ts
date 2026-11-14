import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoredSubscription } from './reminders';

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock('web-push', () => ({ sendNotification }));

const { createWebPushSender } = await import('./sender');

const vapid = { subject: 'mailto:test@example.com', publicKey: 'pub', privateKey: 'priv' };
const subscription: StoredSubscription = {
  endpoint: 'https://push.example/abc',
  keys: { p256dh: 'p', auth: 'a' },
  reminderTime: '07:30',
  timezone: 'Asia/Karachi',
  city: { name: 'Karachi', lat: 24.86, lon: 67 },
  lastSentLocalDate: null,
};

const pushError = (statusCode: number) => Object.assign(new Error('push failed'), { statusCode });

describe('web-push sender', () => {
  afterEach(() => {
    sendNotification.mockReset();
  });

  it('sends with VAPID details, a TTL and a replaceable topic', async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    await expect(createWebPushSender(vapid).send(subscription, '{}')).resolves.toEqual({
      ok: true,
    });
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      '{}',
      expect.objectContaining({ vapidDetails: vapid, topic: 'daily-forecast', TTL: 21_600 }),
    );
  });

  it.each([404, 410])('reports %i as gone', async (status) => {
    sendNotification.mockRejectedValue(pushError(status));
    await expect(createWebPushSender(vapid).send(subscription, '{}')).resolves.toEqual({
      ok: false,
      gone: true,
      status,
    });
  });

  it.each([429, 500, 503])('reports %i as transient', async (status) => {
    sendNotification.mockRejectedValue(pushError(status));
    await expect(createWebPushSender(vapid).send(subscription, '{}')).resolves.toMatchObject({
      ok: false,
      gone: false,
    });
  });

  it('treats network errors as transient', async () => {
    sendNotification.mockRejectedValue(new TypeError('fetch failed'));
    await expect(createWebPushSender(vapid).send(subscription, '{}')).resolves.toEqual({
      ok: false,
      gone: false,
    });
  });
});
