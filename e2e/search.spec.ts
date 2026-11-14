import AxeBuilder from '@axe-core/playwright';
import type { Page, Route } from '@playwright/test';

import { expect, test } from './fixtures.js';

/** Every test mocks /api/cities — no real RapidAPI traffic, fully deterministic. */
const API = /\/api\/cities\?/;

const cities = [
  { id: 1, name: 'Lisbon', region: 'Lisbon District', country: 'Portugal', lat: 38.72, lon: -9.13 },
  {
    id: 2,
    name: 'Lisburn',
    region: 'Northern Ireland',
    country: 'United Kingdom',
    lat: 54.52,
    lon: -6.05,
  },
  {
    id: 3,
    name: 'Lismore',
    region: 'New South Wales',
    country: 'Australia',
    lat: -28.81,
    lon: 153.28,
  },
];

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const queryOf = (route: Route) => new URL(route.request().url()).searchParams.get('q');

async function open(page: Page) {
  await page.goto('/');
  return page.getByRole('combobox', { name: 'City' });
}

test.describe('city search', () => {
  test('idle: shows the hint and no popup below 2 characters', async ({ page }) => {
    let calls = 0;
    await page.route(API, (route) => {
      calls += 1;
      return json(route, 200, { cities });
    });
    const combobox = await open(page);

    await expect(
      page.getByText('Type at least 2 letters, then use ↑ ↓ and Enter to pick a city.'),
    ).toBeVisible();
    await combobox.fill('l');
    await page.waitForTimeout(300); // longer than the 150 ms debounce
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(calls).toBe(0);
  });

  test('loading: shows progress until results arrive', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(API, async (route) => {
      await gate;
      await json(route, 200, { cities });
    });
    const combobox = await open(page);

    await combobox.fill('lis');
    await expect(page.getByText('Searching for “lis”…')).toBeVisible();
    release();
    await expect(page.getByRole('option')).toHaveCount(3);
  });

  test('results: arrow keys + Enter select a city', async ({ page }) => {
    await page.route(API, (route) => json(route, 200, { cities }));
    const combobox = await open(page);

    await combobox.fill('lis');
    await expect(page.getByRole('option')).toHaveCount(3);
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');

    await combobox.press('ArrowDown');
    await combobox.press('ArrowDown');
    const lisburn = page.getByRole('option', { name: /Lisburn/ });
    await expect(lisburn).toHaveAttribute('aria-selected', 'true');
    await expect(combobox).toHaveAttribute(
      'aria-activedescendant',
      (await lisburn.getAttribute('id')) ?? '',
    );

    await combobox.press('Enter');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(combobox).toHaveValue('Lisburn');
    await expect(page.getByRole('heading', { name: 'Lisburn' })).toBeVisible();
  });

  test('results: clicking an option selects it', async ({ page }) => {
    await page.route(API, (route) => json(route, 200, { cities }));
    const combobox = await open(page);
    await combobox.fill('lis');
    await page.getByRole('option', { name: /Lismore/ }).click();
    await expect(page.getByRole('heading', { name: 'Lismore' })).toBeVisible();
    await expect(combobox).toBeFocused();
  });

  test('Escape closes the list, a second Escape clears the field', async ({ page }) => {
    await page.route(API, (route) => json(route, 200, { cities }));
    const combobox = await open(page);
    await combobox.fill('lis');
    await expect(page.getByRole('listbox')).toBeVisible();

    await combobox.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(combobox).toHaveValue('lis');

    await combobox.press('Escape');
    await expect(combobox).toHaveValue('');
  });

  test('clicking outside closes the list', async ({ page }) => {
    await page.route(API, (route) => json(route, 200, { cities }));
    const combobox = await open(page);
    await combobox.fill('lis');
    await expect(page.getByRole('listbox')).toBeVisible();

    await page.getByRole('heading', { name: 'WeatherBoard' }).click();
    await expect(page.getByRole('listbox')).toBeHidden();
  });

  test('typing keeps the previous results visible instead of flashing empty', async ({ page }) => {
    let releaseSecond: () => void = () => undefined;
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    await page.route(API, async (route) => {
      if (queryOf(route) === 'lisb') await secondGate;
      await json(route, 200, { cities: queryOf(route) === 'lisb' ? cities.slice(1, 2) : cities });
    });
    const combobox = await open(page);
    await combobox.fill('lis');
    await expect(page.getByRole('option')).toHaveCount(3);

    await combobox.press('End');
    await combobox.pressSequentially('b');
    await expect(page.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('option')).toHaveCount(3); // old rows stay while loading

    releaseSecond();
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('listbox')).toHaveAttribute('aria-busy', 'false');
  });

  test('no results: explains what to try', async ({ page }) => {
    await page.route(API, (route) => json(route, 200, { cities: [] }));
    const combobox = await open(page);
    await combobox.fill('xqzv');
    await expect(page.getByText('No cities match “xqzv”.')).toBeVisible();
    await expect(
      page.getByText(/Check the spelling, try just the first few letters/),
    ).toBeVisible();
    await expect(page.getByRole('listbox')).toBeHidden();
  });

  test('rate limited: explains, counts down and retries automatically', async ({ page }) => {
    let calls = 0;
    await page.route(API, (route) => {
      calls += 1;
      return calls === 1
        ? json(route, 429, {
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many searches right now.',
              retryAfterSeconds: 2,
            },
          })
        : json(route, 200, { cities });
    });
    const combobox = await open(page);
    await combobox.fill('lis');

    await expect(page.getByText('Too many searches right now')).toBeVisible();
    await expect(page.getByText(/City search allows about one request per second/)).toBeVisible();
    await expect(page.getByText(/Retrying in [12]s…/)).toBeVisible();

    await expect(page.getByRole('option')).toHaveCount(3, { timeout: 5_000 });
    expect(calls).toBe(2);
  });

  test('network failure: shows a retry button that recovers', async ({ page }) => {
    let online = false;
    await page.route(API, (route) =>
      online ? json(route, 200, { cities }) : route.abort('internetdisconnected'),
    );
    const combobox = await open(page);
    await combobox.fill('lis');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Couldn’t reach city search');
    await expect(alert).toContainText('Check your internet connection');

    online = true;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('option')).toHaveCount(3);
    await expect(combobox).toBeFocused();
  });

  test('server failure: says it is on our side and offers a retry', async ({ page }) => {
    await page.route(API, (route) =>
      json(route, 502, {
        error: { code: 'UPSTREAM_ERROR', message: 'City search is temporarily unavailable.' },
      }),
    );
    const combobox = await open(page);
    await combobox.fill('lis');
    await expect(page.getByRole('alert')).toContainText('City search is unavailable right now');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('validation: an error only after typing then leaving the field empty, gone on refocus', async ({
    page,
  }) => {
    const combobox = await open(page);
    const error = page.getByText('Enter a city name to search.');

    // Clicking in and out of an untouched field is not a mistake.
    await combobox.focus();
    await page.keyboard.press('Tab');
    await expect(error).toBeHidden();

    // Typing then clearing stays quiet while focused…
    await combobox.fill('Li');
    await combobox.fill('');
    await expect(error).toBeHidden();
    // …and explains once the user leaves the field empty.
    await page.keyboard.press('Tab');
    await expect(error).toBeVisible();
    await expect(combobox).toHaveAttribute('aria-invalid', 'true');

    // Back in the field: the error goes away while they fix it.
    await combobox.focus();
    await expect(error).toBeHidden();
  });

  test('a focused field shows one ring over its border, not a second outline', async ({ page }) => {
    const combobox = await open(page);
    await combobox.focus();
    const ring = await combobox.evaluate((element) => {
      const style = getComputedStyle(element);
      return { offset: style.outlineOffset, width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(ring).toEqual({ offset: '-1px', width: '2px', style: 'solid' });
  });

  test('open results have no detectable WCAG 2.2 AA violations', async ({ page }) => {
    await page.route(API, (route) => json(route, 200, { cities }));
    const combobox = await open(page);
    await combobox.fill('lis');
    await combobox.press('ArrowDown');
    await expect(page.getByRole('option')).toHaveCount(3);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
