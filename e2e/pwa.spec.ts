import type { BrowserContext, Page } from '@playwright/test';

import { expect, json, test, weatherBundle } from './fixtures.js';

// This spec exercises the real service worker (blocked in every other spec).
test.use({ serviceWorkers: 'allow' });

const lisbon = {
  id: 1,
  name: 'Lisbon',
  region: 'Lisbon District',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.13,
};

/**
 * Requests made by the service worker itself are only visible to context-level routes,
 * so weather and cities are mocked on the context here.
 */
async function mockApis(context: BrowserContext) {
  const weatherCalls: string[] = [];
  await context.route(/\/api\/weather\?/, (route) => {
    weatherCalls.push(route.request().url());
    return json(route, 200, weatherBundle());
  });
  await context.route(/\/api\/cities\?/, (route) => json(route, 200, { cities: [lisbon] }));
  return weatherCalls;
}

/** Loads the app and waits until the service worker controls the page. */
async function loadControlled(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
    await page.reload(); // first visit: the worker activates, the next load is controlled
  }
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

const cacheUrls = (page: Page) =>
  page.evaluate(async () => {
    const result: Record<string, string[]> = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      result[name] = (await cache.keys()).map(
        (request) => new URL(request.url).pathname + new URL(request.url).search,
      );
    }
    return result;
  });

test.describe('PWA', () => {
  test('serves a valid manifest with 192, 512 and maskable icons', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');

    const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      scope: string;
      theme_color: string;
      background_color: string;
      icons: { src: string; sizes: string; purpose: string }[];
    };
    expect(manifest).toMatchObject({
      name: 'WeatherBoard',
      short_name: 'WeatherBoard',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      theme_color: '#5359d1',
      background_color: '#f7f8fa',
    });
    expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual([
      '192x192 any',
      '512x512 any',
      '512x512 maskable',
    ]);
    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('offline: the app shell and the last viewed city load from cache, with a clear label', async ({
    page,
    context,
  }) => {
    await mockApis(context);
    await loadControlled(page);
    await expect(page.getByText('29°', { exact: true })).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'WeatherBoard' })).toBeVisible(); // precached shell
    await expect(page.getByText('You’re offline', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('29°', { exact: true })).toBeVisible(); // from the weather cache
    await expect(page.getByText(/Offline — saved data\./)).toBeVisible();
    // Age is computed from the observation time: "just now" or "… ago" depending on the clock.
    await expect(page.getByText(/This weather was observed (just now|.+ ago)/)).toBeVisible();

    // Going back online clears the offline UI.
    await context.setOffline(false);
    await expect(page.getByText(/Offline — saved data\./)).toBeHidden();
  });

  test('the weather cache keeps only the last viewed city; city search is never cached', async ({
    page,
    context,
  }) => {
    await mockApis(context);
    await loadControlled(page);
    await expect(page.getByText('29°', { exact: true })).toBeVisible();

    await page.getByRole('combobox', { name: 'City' }).fill('lis');
    await page.getByRole('option', { name: /Lisbon/ }).click();
    await expect(page.getByRole('heading', { name: 'Lisbon', exact: true })).toBeVisible();

    await expect
      .poll(async () => (await cacheUrls(page))['weather-last-city'])
      .toEqual(['/api/weather?lat=38.72&lon=-9.13']);
    const everything = Object.values(await cacheUrls(page)).flat();
    expect(everything.some((url) => url.startsWith('/api/cities'))).toBe(false);
  });

  test('offline: city search explains it needs a connection instead of spinning forever', async ({
    page,
    context,
  }) => {
    await mockApis(context);
    await loadControlled(page);
    await expect(page.getByText('29°', { exact: true })).toBeVisible();
    await context.setOffline(true);

    await page.getByRole('combobox', { name: 'City' }).fill('lis');
    await expect(page.getByText('City search needs a connection.', { exact: false })).toBeVisible();
    await expect(page.getByText(/Searching for/)).toBeHidden();
  });

  test('custom install button uses the deferred beforeinstallprompt', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Install app' })).toBeHidden();

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: () => {
          (window as unknown as { promptCalls: number }).promptCalls = 1;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      });
      window.dispatchEvent(event);
    });

    const install = page.getByRole('button', { name: 'Install app' });
    await expect(install).toBeVisible();
    await install.click();
    await expect(install).toBeHidden(); // a prompt can be used once
    expect(
      await page.evaluate(() => (window as unknown as { promptCalls?: number }).promptCalls),
    ).toBe(1);
  });
});
