import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, json, test, WEATHER_API, weatherBundle } from './fixtures.js';

const KEY = 'weatherboard:favorites:v1';
const city = (id: number, name: string, lat: number, lon: number) => ({
  id,
  name,
  region: null,
  country: 'Testland',
  lat,
  lon,
});
const lisbon = city(1, 'Lisbon', 38.72, -9.13);
const tokyo = city(2, 'Tokyo', 35.68, 139.69);
const lima = city(3, 'Lima', -12.05, -77.04);
const oslo = city(4, 'Oslo', 59.91, 10.75);
const cairo = city(5, 'Cairo', 30.04, 31.24);

async function seed(page: Page, cities: unknown[]) {
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [KEY, JSON.stringify(cities)] as const,
  );
  await page.reload();
}

const favouritesList = (page: Page) => page.getByRole('list', { name: 'Favourite cities' });
const chip = (page: Page, name: string) =>
  favouritesList(page).getByRole('button', { name: new RegExp(`^${name}`) });
const removeButton = (page: Page, name: string) =>
  page.getByRole('button', { name: `Remove ${name} from favourites` });
const saveToggle = (page: Page) => page.getByRole('button', { name: /as a favourite$/ });

test.describe('favourites', () => {
  test('add: saving the current city adds a chip that survives a reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('No favourites yet.')).toBeVisible();

    await saveToggle(page).click();
    await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'Karachi')).toBeVisible();

    await page.reload();
    await expect(chip(page, 'Karachi')).toBeVisible();
    await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('a favourite is selectable by keyboard', async ({ page }) => {
    await seed(page, [lisbon]);
    await chip(page, 'Lisbon').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Lisbon', exact: true })).toBeVisible();
    await expect(chip(page, 'Lisbon')).toHaveAttribute('aria-current', 'true');
  });

  test('hovering a favourite prefetches its weather, so selecting it needs no new request', async ({
    page,
  }) => {
    await seed(page, [lisbon]);
    const lisbonCalls: string[] = [];
    await page.route(WEATHER_API, (route) => {
      if (new URL(route.request().url()).searchParams.get('lat') === '38.72') {
        lisbonCalls.push(route.request().url());
      }
      return json(route, 200, weatherBundle());
    });

    await chip(page, 'Lisbon').hover();
    await expect.poll(() => lisbonCalls.length).toBe(1);

    await chip(page, 'Lisbon').click();
    await expect(page.getByRole('heading', { name: 'Lisbon', exact: true })).toBeVisible();
    await expect(page.getByText('29°', { exact: true })).toBeVisible();
    expect(lisbonCalls).toHaveLength(1);
  });

  test('limit: a sixth city is refused with a clear message', async ({ page }) => {
    await seed(page, [lisbon, tokyo, lima, oslo, cairo]);
    await expect(favouritesList(page).getByRole('listitem')).toHaveCount(5);

    await saveToggle(page).click(); // Karachi would be the sixth
    await expect(
      page.getByText('You already have 5 favourites. Remove one to add Karachi.'),
    ).toBeVisible();
    await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(favouritesList(page).getByRole('listitem')).toHaveCount(5);

    // Making room clears the message and lets the save through.
    await removeButton(page, 'Cairo').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText(/You already have 5 favourites/)).toBeHidden();
    await saveToggle(page).click();
    await expect(chip(page, 'Karachi')).toBeVisible();
  });

  test('confirm-remove: cancel keeps it and returns focus to ×; confirm removes and focuses the next chip', async ({
    page,
  }) => {
    await seed(page, [lisbon, tokyo, lima]);

    await removeButton(page, 'Tokyo').click();
    const dialog = page.getByRole('dialog', { name: 'Remove Tokyo from favourites?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(removeButton(page, 'Tokyo')).toBeFocused();
    await expect(chip(page, 'Tokyo')).toBeVisible();

    await removeButton(page, 'Tokyo').click();
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect(chip(page, 'Tokyo')).toBeHidden();
    await expect(chip(page, 'Lima')).toBeFocused(); // the chip that moved into its place
  });

  test('removing the last favourite moves focus to city search', async ({ page }) => {
    await seed(page, [lisbon]);
    await removeButton(page, 'Lisbon').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('No favourites yet.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'City' })).toBeFocused();
  });

  test('unsaving from the weather card confirms first and keeps focus on the toggle', async ({
    page,
  }) => {
    await page.goto('/');
    await saveToggle(page).click();
    await saveToggle(page).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(saveToggle(page)).toBeFocused();
  });

  test('storage disabled: falls back to memory with a dismissible explanation', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
    });
    await page.goto('/');

    const notice = page.getByText('Favourites won’t be saved');
    await expect(notice).toBeVisible();
    await saveToggle(page).click();
    await expect(chip(page, 'Karachi')).toBeVisible(); // still works, in memory

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice).toBeHidden();
  });

  test('chips scroll horizontally at 375 px; a vertical sidebar at 1280 px', async ({ page }) => {
    await seed(page, [lisbon, tokyo, lima, oslo, cairo]);
    const direction = () =>
      favouritesList(page).evaluate((list) => getComputedStyle(list).flexDirection);
    const pageOverflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

    await page.setViewportSize({ width: 375, height: 812 });
    expect(await direction()).toBe('row');
    expect(await pageOverflow()).toBeLessThanOrEqual(0);
    const chipBox = await chip(page, 'Lisbon').boundingBox();
    expect(chipBox?.height).toBeGreaterThanOrEqual(44);

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await direction()).toBe('column');
    expect(await pageOverflow()).toBeLessThanOrEqual(0);
  });

  test('panel and open dialog have no detectable WCAG 2.2 AA violations', async ({ page }) => {
    await seed(page, [lisbon, tokyo]);
    await removeButton(page, 'Lisbon').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
