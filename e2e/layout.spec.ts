import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.js';

const viewports = [
  { width: 375, height: 812, columns: 1 },
  { width: 768, height: 1024, columns: 2 },
  { width: 1280, height: 800, columns: 12 },
];

for (const { width, height, columns } of viewports) {
  test(`at ${String(width)}px the grid has ${String(columns)} column(s) and no horizontal scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');

    const grid = page.getByTestId('dashboard-grid');
    const trackCount = await grid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    );
    expect(trackCount).toBe(columns);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('skip link is the first tab stop and moves focus to main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('dark theme has no detectable WCAG 2.2 AA violations', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
