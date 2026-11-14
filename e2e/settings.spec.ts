import type { Page } from '@playwright/test';

import { expect, json, test, WEATHER_API, weatherBundle } from './fixtures.js';

const unitsGroup = (page: Page) => page.getByRole('group', { name: 'Temperature unit' });
const themeGroup = (page: Page) => page.getByRole('group', { name: /^Theme/ });

test.describe('theme', () => {
  test('dark persists after reload and is applied before the app’s JavaScript runs', async ({
    page,
  }) => {
    await page.goto('/');
    await themeGroup(page).getByRole('button', { name: 'Dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Hold back every app bundle: only theme-init.js (in <head>) can set the theme now.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/assets\/.*\.js$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => document.querySelector('body') !== null);

    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    expect(await page.evaluate(() => document.getElementById('root')?.childElementCount)).toBe(0);
    release();

    await expect(themeGroup(page).getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const background = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(background).toBe('rgb(13, 14, 17)'); // --wb-canvas (dark)
  });

  test('system follows the OS preference, live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(themeGroup(page)).toHaveAccessibleName('Theme (now light)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(themeGroup(page)).toHaveAccessibleName('Theme (now dark)');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });
});

test.describe('units', () => {
  test('°F switches temperatures and wind instantly — no refetch, no reload — and persists', async ({
    page,
  }) => {
    let weatherCalls = 0;
    await page.route(WEATHER_API, (route) => {
      weatherCalls += 1;
      return json(route, 200, weatherBundle());
    });
    await page.goto('/');
    // The big current temperature reads e.g. "29° Celsius" (unit name is visually hidden).
    const currentTemperature = page.getByText(/^\d+°\s*(Celsius|Fahrenheit)$/);
    await expect(currentTemperature).toHaveText(/^29°\s*Celsius$/);
    await expect(page.getByText('17 km/h')).toBeVisible();
    const callsBefore = weatherCalls;
    await page.evaluate(() => {
      (window as unknown as { marker: boolean }).marker = true;
    });

    await unitsGroup(page).getByRole('button', { name: '°F' }).click();

    await expect(currentTemperature).toHaveText(/^85°\s*Fahrenheit$/); // 29.4 °C
    await expect(page.getByText('17 km/h')).toBeVisible(); // wind unchanged: °F is temperature only
    await expect(page.getByRole('listitem').filter({ hasText: 'Today' })).toContainText('88°'); // 31 °C
    expect(weatherCalls).toBe(callsBefore); // no refetch
    expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(
      true,
    ); // no reload

    await page.reload();
    await expect(currentTemperature).toHaveText(/^85°\s*Fahrenheit$/);
    await expect(unitsGroup(page).getByRole('button', { name: '°F' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('animated icons', () => {
  test('animate by default and pause when offscreen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 640 });
    await page.goto('/');
    const current = page.locator('svg.wx-icon').first();
    await expect(current).toBeVisible();
    const animationName = await current
      .locator('[data-anim]')
      .first()
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(animationName).not.toBe('none');

    // The last forecast day is far below the fold at this size.
    const offscreen = page.locator('li svg.wx-icon').last();
    await expect(offscreen).toHaveAttribute('data-paused', '');
    await offscreen.scrollIntoViewIfNeeded();
    await expect(offscreen).not.toHaveAttribute('data-paused');
  });

  test('are fully disabled under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('svg.wx-icon').first()).toBeVisible();
    const names = await page
      .locator('svg.wx-icon [data-anim]')
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).animationName),
      );
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names)).toEqual(new Set(['none']));
  });
});
