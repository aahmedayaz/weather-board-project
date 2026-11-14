import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Page } from '@playwright/test';

import { expect, json, test, weatherBundle } from './fixtures.js';

// Real service worker (so serviceWorker.ready resolves); permission + subscription are stubbed.
test.use({ serviceWorkers: 'allow' });

const WORKER = 'https://push.weatherboard.test'; // from .env.e2e

interface PushStub {
  permission: NotificationPermission;
  nextPermission: NotificationPermission;
  requestCalls: number;
  subscribeCalls: { userVisibleOnly: boolean; keyBytes: number }[];
  unsubscribed: boolean;
}

/** Stubs the browser's permission and PushManager APIs before any app code runs. */
async function stubPush(context: BrowserContext, initial: Partial<PushStub> = {}) {
  await context.addInitScript((seed: Partial<PushStub>) => {
    const state = {
      permission: 'default' as NotificationPermission,
      nextPermission: 'granted' as NotificationPermission,
      requestCalls: 0,
      subscribeCalls: [] as { userVisibleOnly: boolean; keyBytes: number }[],
      unsubscribed: false,
      ...seed,
    };
    let current: PushSubscription | null = null;
    Object.assign(window, { __push: state });

    Object.defineProperty(Notification, 'permission', {
      configurable: true,
      get: () => state.permission,
    });
    Notification.requestPermission = () => {
      state.requestCalls += 1;
      state.permission = state.nextPermission;
      return Promise.resolve(state.permission);
    };

    const fake = {
      endpoint: 'https://push.example.test/sub/abc',
      expirationTime: null,
      toJSON: () => ({
        endpoint: 'https://push.example.test/sub/abc',
        expirationTime: null,
        keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
      }),
      unsubscribe: () => {
        state.unsubscribed = true;
        current = null;
        return Promise.resolve(true);
      },
    };
    PushManager.prototype.subscribe = function (options?: PushSubscriptionOptionsInit) {
      const key = options?.applicationServerKey;
      state.subscribeCalls.push({
        userVisibleOnly: options?.userVisibleOnly === true,
        keyBytes: key instanceof Uint8Array ? key.length : 0,
      });
      current = fake as unknown as PushSubscription;
      return Promise.resolve(current);
    };
    PushManager.prototype.getSubscription = () => Promise.resolve(current);
  }, initial);
}

/** Fakes the worker, including the CORS preflight a cross-origin JSON POST triggers. */
async function mockWorker(context: BrowserContext, status = 201) {
  const posts: { path: string; body: unknown }[] = [];
  await context.route(`${WORKER}/**`, async (route) => {
    const request = route.request();
    const cors = {
      'Access-Control-Allow-Origin': 'http://localhost:4173',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    posts.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() as unknown });
    return route.fulfill({
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify(status < 300 ? { ok: true } : { error: { code: 'BOOM', message: 'x' } }),
    });
  });
  await context.route(/\/api\/weather\?/, (route) => json(route, 200, weatherBundle()));
  return posts;
}

const pushState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __push: PushStub }).__push);

test.describe('daily reminder (push)', () => {
  test('explainer first; permission only after confirm; subscribes and registers with the worker', async ({
    page,
    context,
  }) => {
    await stubPush(context);
    const posts = await mockWorker(context);
    await page.goto('/');

    await page.getByRole('button', { name: 'Set up daily reminder' }).click();
    const dialog = page.getByRole('dialog', { name: 'Daily forecast for Karachi?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('What you get')).toBeVisible();
    await expect(dialog.getByText('When', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Turning it off')).toBeVisible();
    expect((await pushState(page)).requestCalls).toBe(0); // no prompt yet

    // Time picker is validated on blur.
    const time = dialog.getByLabel('Reminder time');
    await time.fill('07:32');
    await time.blur();
    await expect(
      dialog.getByText('Choose a time in 5-minute steps, like 07:30 or 07:35.'),
    ).toBeVisible();
    await time.fill('06:45');
    await expect(dialog.getByText(/5-minute steps, like/)).toBeHidden();

    await dialog.getByRole('button', { name: 'Turn on reminders' }).click();

    await expect(page.getByText(/Daily reminder at\s*06:45\s*for\s*Karachi/)).toBeVisible();
    const state = await pushState(page);
    expect(state.requestCalls).toBe(1);
    expect(state.subscribeCalls).toEqual([{ userVisibleOnly: true, keyBytes: 65 }]);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.path).toBe('/subscribe');
    expect(posts[0]?.body).toMatchObject({
      reminderTime: '06:45',
      timezone: expect.stringMatching(/\//),
      city: { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
      subscription: { endpoint: 'https://push.example.test/sub/abc' },
    });
  });

  test('turning it off unsubscribes in the browser and on the worker', async ({
    page,
    context,
  }) => {
    await stubPush(context);
    const posts = await mockWorker(context);
    await page.goto('/');
    await page.getByRole('button', { name: 'Set up daily reminder' }).click();
    await page.getByRole('button', { name: 'Turn on reminders' }).click();
    await expect(page.getByText(/Daily reminder at/)).toBeVisible();

    await page.getByRole('button', { name: 'Turn off' }).click();
    await expect(page.getByRole('button', { name: 'Set up daily reminder' })).toBeVisible();
    expect((await pushState(page)).unsubscribed).toBe(true);
    expect(posts.at(-1)).toEqual({
      path: '/unsubscribe',
      body: { endpoint: 'https://push.example.test/sub/abc' },
    });
  });

  test('denied at the prompt: explains how to re-enable, and the rest of the app keeps working', async ({
    page,
    context,
  }) => {
    await stubPush(context, { nextPermission: 'denied' });
    const posts = await mockWorker(context);
    await page.goto('/');
    await page.getByRole('button', { name: 'Set up daily reminder' }).click();
    await page.getByRole('button', { name: 'Turn on reminders' }).click();

    await expect(page.getByText('Notifications are blocked for WeatherBoard')).toBeVisible();
    await expect(page.getByText(/Notifications → Allow, then reload the page/)).toBeVisible();
    expect((await pushState(page)).subscribeCalls).toHaveLength(0);
    expect(posts).toHaveLength(0);
    await expect(page.getByText('29°', { exact: true })).toBeVisible();
  });

  test('already denied: shows the instructions straight away, without a prompt', async ({
    page,
    context,
  }) => {
    await stubPush(context, { permission: 'denied' });
    await mockWorker(context);
    await page.goto('/');
    await expect(page.getByText('Notifications are blocked for WeatherBoard')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set up daily reminder' })).toBeHidden();
    expect((await pushState(page)).requestCalls).toBe(0);
  });

  test('worker failure keeps the dialog open with a specific message', async ({
    page,
    context,
  }) => {
    await stubPush(context);
    await mockWorker(context, 500);
    await page.goto('/');
    await page.getByRole('button', { name: 'Set up daily reminder' }).click();
    await page.getByRole('button', { name: 'Turn on reminders' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Reminder not set up')).toBeVisible();
    await expect(
      dialog.getByText('The reminder service refused the request (BOOM).'),
    ).toBeVisible();
  });

  test('missing Push API: clear fallback, nothing else breaks', async ({ page, context }) => {
    await context.addInitScript(() => {
      Reflect.deleteProperty(window, 'PushManager');
    });
    await mockWorker(context);
    await page.goto('/');
    await expect(page.getByText('This browser can’t send reminders')).toBeVisible();
    await expect(page.getByText(/doesn’t support the Push API/)).toBeVisible();
    await expect(page.getByText('29°', { exact: true })).toBeVisible();
  });

  test('explainer dialog has no detectable WCAG 2.2 AA violations', async ({ page, context }) => {
    await stubPush(context);
    await mockWorker(context);
    await page.goto('/');
    await page.getByRole('button', { name: 'Set up daily reminder' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('daily reminder on iOS', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test('outside the installed app, explains that iOS needs the PWA installed', async ({
    page,
    context,
  }) => {
    await mockWorker(context);
    await page.goto('/');
    await expect(page.getByText('Install WeatherBoard to get reminders')).toBeVisible();
    await expect(page.getByText(/Add to Home Screen/)).toBeVisible();
  });
});

test('opening a reminder link shows that city and remembers it', async ({ page }) => {
  await page.route(/\/api\/weather\?/, (route) => json(route, 200, weatherBundle()));
  await page.goto('/?name=Lahore&lat=31.55&lon=74.34');
  await expect(page.getByRole('heading', { name: 'Lahore', exact: true })).toBeVisible();
  expect(new URL(page.url()).search).toBe(''); // cleaned up
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lahore', exact: true })).toBeVisible();
});
