import { Button } from '@/shared/ui';

import { applyUpdate, dismissUpdate, usePwaState } from '../pwaStore';

/** Bottom toast when a new version is waiting. Polite: it never steals focus. */
export function UpdateToast() {
  const { updateAvailable } = usePwaState();
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center sm:inset-x-auto sm:right-4"
    >
      {updateAvailable && (
        <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-3 rounded-lg bg-surface p-4 text-sm shadow-overlay sm:flex-row sm:items-center">
          <p className="flex-1 text-fg">
            <span className="font-semibold">A new version is available.</span> Reload to get the
            latest WeatherBoard.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={dismissUpdate}>
              Later
            </Button>
            <Button variant="primary" onClick={() => void applyUpdate()}>
              Reload
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
