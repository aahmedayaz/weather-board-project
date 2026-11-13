import type { ReactNode } from 'react';

/**
 * Page grid: 1 column on phones, 2 from 768 px (md), a 12-column dashboard from 1280 px (xl).
 * Children place themselves with spans, e.g. `md:col-span-2 xl:col-span-8`.
 * `*:min-w-0` lets grid items shrink below their content width, so long content wraps or
 * scrolls inside its card instead of pushing the page into horizontal scroll.
 */
export function DashboardGrid({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="dashboard-grid"
      className="grid grid-cols-1 gap-4 *:min-w-0 md:grid-cols-2 md:gap-5 xl:grid-cols-12 xl:gap-6"
    >
      {children}
    </div>
  );
}
