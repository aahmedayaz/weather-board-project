import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('loads with the app heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('WeatherBoard');
    await expect(page.getByRole('heading', { level: 1, name: 'WeatherBoard' })).toBeVisible();
  });

  test('has no detectable WCAG 2.2 AA violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
