import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-fg">
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-4 py-3 text-sm font-medium shadow-overlay focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-2.5 px-4 md:px-6">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <rect width="24" height="24" rx="6" fill="var(--wb-accent)" />
            <circle cx="12" cy="12" r="4.5" fill="var(--wb-accent-fg)" />
          </svg>
          <h1 className="text-[15px] font-semibold tracking-tight">WeatherBoard</h1>
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
