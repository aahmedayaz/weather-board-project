import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, json, test, WEATHER_API } from './fixtures.js';

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 900 },
] as const;

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
];
const favourites = [
  cities[0],
  { ...cities[1], id: 2 },
  { id: 3, name: 'Tokyo', region: null, country: 'Japan', lat: 35.68, lon: 139.69 },
];

/** Each UI state the suite checks, reached from a fresh page. */
const STATES: { name: string; reach: (page: Page) => Promise<void> }[] = [
  {
    name: 'dashboard',
    reach: async (page) => {
      await page.goto('/');
      await expect(page.getByText('Weather data: Open-Meteo')).toBeVisible();
    },
  },
  {
    name: 'search results open',
    reach: async (page) => {
      await page.route(/\/api\/cities\?/, (route) => json(route, 200, { cities }));
      await page.goto('/');
      await page.getByRole('combobox', { name: 'City' }).fill('lis');
      await expect(page.getByRole('option')).toHaveCount(2);
    },
  },
  {
    name: 'favourites + remove dialog',
    reach: async (page) => {
      await page.goto('/');
      await page.evaluate((value) => {
        window.localStorage.setItem('weatherboard:favorites:v1', value);
      }, JSON.stringify(favourites));
      await page.reload();
      await page.getByRole('button', { name: 'Remove Lisbon from favourites' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'weather error',
    reach: async (page) => {
      await page.route(WEATHER_API, (route) =>
        json(route, 404, { error: { code: 'NOT_FOUND', message: 'none' } }),
      );
      await page.goto('/');
      await expect(page.getByText('No weather found for Karachi').first()).toBeVisible();
    },
  },
];

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Visible interactive elements smaller than 44×44. Clipped (sr-only) elements aren't targets. */
const undersizedTargets = (page: Page) =>
  page.evaluate(() => {
    const selector =
      'a[href], button, input, select, textarea, [role="button"], [role="option"], [tabindex]:not([tabindex="-1"])';
    const tooSmall: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const hidden =
        box.width <= 1 ||
        box.height <= 1 ||
        style.visibility === 'hidden' ||
        style.clipPath === 'inset(50%)' || // Tailwind sr-only (e.g. the skip link until focused)
        element.closest('[inert], [aria-hidden="true"]') !== null;
      if (hidden) continue;
      if (box.width < 43.5 || box.height < 43.5) {
        const name = element.getAttribute('aria-label') ?? element.textContent.trim().slice(0, 30);
        tooSmall.push(
          `${element.tagName.toLowerCase()} "${name}" ${box.width.toFixed(0)}×${box.height.toFixed(0)}`,
        );
      }
    }
    return tooSmall;
  });

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name} px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const state of STATES) {
      test(`${state.name}: no horizontal scroll, no axe violations`, async ({ page }) => {
        await state.reach(page);

        expect(
          await horizontalOverflow(page),
          'scrollWidth must not exceed clientWidth',
        ).toBeLessThanOrEqual(0);

        if (viewport.width === 375) {
          expect(await undersizedTargets(page), 'touch targets below 44×44 px').toEqual([]);
        }

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}

test.describe('skip link at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('is a full-size target once focused', async ({ page }) => {
    await page.goto('/');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeAttached();
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
