import type { ReactNode } from 'react';

export function AppShell({
  children,
  headerActions,
}: {
  children: ReactNode;
  /** Right side of the header (e.g. the install button). */
  headerActions?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-fg">
      <a
        href="#main"
        // not-sr-only resets padding to 0, so the 44 px height comes from min-height instead.
        className="sr-only rounded-md bg-surface text-sm font-medium shadow-overlay focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex min-h-14 w-full max-w-[1440px] flex-wrap items-center gap-x-2.5 gap-y-2 px-4 py-2 md:px-6">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <rect width="24" height="24" rx="6" fill="var(--wb-accent)" />
            <circle cx="12" cy="12" r="4.5" fill="var(--wb-accent-fg)" />
          </svg>
          <h1 className="text-[15px] font-semibold tracking-tight">WeatherBoard</h1>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {headerActions}
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 focus:outline-none md:px-6 md:py-8"
      >
        {children}
      </main>
    </div>
  );
}
