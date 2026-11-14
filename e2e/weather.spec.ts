import AxeBuilder from '@axe-core/playwright';
import type { Page, Request } from '@playwright/test';

import { expect, json, test, WEATHER_API, weatherBundle } from './fixtures.js';

const LAST_CITY_KEY = 'weatherboard:last-city:v1';
const lisbon = {
  id: 1,
  name: 'Lisbon',
  region: 'Lisbon District',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.13,
};

const coordsOf = (request: Request) => {
  const params = new URL(request.url()).searchParams;
  return `${params.get('lat') ?? ''},${params.get('lon') ?? ''}`;
};

/** Counts /api/weather calls and answers each with `reply(callNumber)`. */
async function routeWeather(
  page: Page,
  reply: (call: number) => { status: number; body: unknown } | 'abort',
) {
  const calls: string[] = [];
  await page.route(WEATHER_API, (route) => {
    calls.push(coordsOf(route.request()));
    const answer = reply(calls.length);
    return answer === 'abort'
      ? route.abort('internetdisconnected')
      : json(route, answer.status, answer.body);
  });
  return calls;
}

const ok = { status: 200, body: weatherBundle() };
const apiError = (status: number, code: string) => ({
  status,
  body: { error: { code, message: code } },
});

test.describe('weather display', () => {
  test('defaults to Karachi and shows current conditions, 5 days and the source', async ({
    page,
  }) => {
    const calls = await routeWeather(page, () => ok);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Karachi' })).toBeVisible();
    await expect(page.getByText('Sindh, Pakistan')).toBeVisible();
    await expect(page.getByText('29°', { exact: true })).toBeVisible();
    await expect(page.getByText('Partly cloudy').first()).toBeVisible();
    await expect(page.getByText('17 km/h')).toBeVisible();

    const days = page.getByRole('list').filter({ hasText: 'Today' }).getByRole('listitem');
    await expect(days).toHaveCount(5);
    await expect(days.first()).toContainText('Today');
    await expect(days.nth(2)).toContainText('70%');
    await expect(page.getByText('Weather data: Open-Meteo')).toBeVisible();

    expect(calls).toEqual(['24.86,67']); // one request, shared by every component
  });

  test('shows skeletons while loading', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(WEATHER_API, async (route) => {
      await gate;
      await json(route, 200, weatherBundle());
    });
    await page.goto('/');

    await expect(page.getByText('Loading current conditions for Karachi…')).toBeAttached();
    await expect(page.getByText('Loading the 5-day forecast for Karachi…')).toBeAttached();
    release();
    await expect(page.getByText('29°', { exact: true })).toBeVisible();
  });

  test('remembers the last viewed city across reloads', async ({ page }) => {
    const calls = await routeWeather(page, () => ok);
    await page.route(/\/api\/cities\?/, (route) => json(route, 200, { cities: [lisbon] }));
    await page.goto('/');

    await page.getByRole('combobox', { name: 'City' }).fill('lis');
    await page.getByRole('option', { name: /Lisbon/ }).click();
    await expect(page.getByRole('heading', { name: 'Lisbon', exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Lisbon', exact: true })).toBeVisible();
    expect(calls.at(-1)).toBe('38.72,-9.13');
  });

  test('ignores a tampered stored city and falls back to Karachi', async ({ page }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ name: '<img src=x onerror=alert(1)>', lat: 'x' }),
      );
    }, LAST_CITY_KEY);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Karachi' })).toBeVisible();
  });

  test('offline: explains, and "Try again" recovers', async ({ page }) => {
    let online = false;
    await routeWeather(page, () => (online ? ok : 'abort'));
    await page.goto('/');

    await expect(page.getByText('You’re offline').first()).toBeVisible();
    await expect(page.getByText(/Couldn’t load current conditions for Karachi/)).toBeVisible();

    online = true;
    await page.getByRole('button', { name: 'Try again' }).first().click();
    await expect(page.getByText('29°', { exact: true })).toBeVisible();
  });

  test('rate limited: explains and does not retry automatically', async ({ page }) => {
    const calls = await routeWeather(page, () => apiError(429, 'RATE_LIMITED'));
    await page.goto('/');

    await expect(page.getByText('Too many weather requests').first()).toBeVisible();
    await page.waitForTimeout(2500); // longer than the first two backoff steps
    expect(calls).toHaveLength(1);
  });

  test('city not found: "Search another city" moves focus to search, no retries', async ({
    page,
  }) => {
    const calls = await routeWeather(page, () => apiError(404, 'NOT_FOUND'));
    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('No weather found for Karachi');
    await page.getByRole('button', { name: 'Search another city' }).first().click();
    await expect(page.getByRole('combobox', { name: 'City' })).toBeFocused();
    expect(calls).toHaveLength(1);
  });

  test('server problem: retries with backoff (1 s, 2 s, 4 s), then explains', async ({ page }) => {
    const calls = await routeWeather(page, () => apiError(502, 'UPSTREAM_ERROR'));
    await page.goto('/');

    await expect(page.getByText('Weather service problem').first()).toBeVisible({
      timeout: 15_000,
    });
    expect(calls).toHaveLength(4); // 1 attempt + 3 retries
    await expect(page.getByRole('button', { name: 'Try again' }).first()).toBeVisible();
  });

  test('manual refresh is throttled to once per 10 s with visible feedback', async ({ page }) => {
    const calls = await routeWeather(page, () => ok);
    await page.goto('/');
    await expect(page.getByText('29°', { exact: true })).toBeVisible();

    const refresh = page.getByRole('button', { name: /Refresh/ });
    await refresh.click();
    await expect(page.getByText(/^Refresh again in \d+s$/)).toBeVisible();
    await expect(refresh).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText(/^Updated /)).toBeVisible();
    expect(calls).toHaveLength(2);

    // `force`: Playwright would otherwise wait for aria-disabled to clear (i.e. sit out the
    // cooldown). A user mashing the button doesn't wait — these clicks must be ignored.
    for (let press = 0; press < 5; press += 1) await refresh.click({ force: true });
    await page.waitForTimeout(300);
    expect(calls).toHaveLength(2);
    await expect(refresh).toBeFocused(); // aria-disabled (not disabled) keeps focus in place
  });

  test('rapid tab switching cannot spam the API', async ({ page }) => {
    const calls = await routeWeather(page, () => apiError(429, 'RATE_LIMITED'));
    await page.goto('/');
    await expect(page.getByText('Too many weather requests').first()).toBeVisible();

    // Simulate ten quick returns to the tab. The query is stale (it failed), so without the
    // throttle each one would refetch.
    for (let index = 0; index < 10; index += 1) {
      await page.evaluate(() => {
        window.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      });
    }
    await page.waitForTimeout(500);
    expect(calls).toHaveLength(1);
  });

  test('loaded dashboard has no detectable WCAG 2.2 AA violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Weather data: Open-Meteo')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
