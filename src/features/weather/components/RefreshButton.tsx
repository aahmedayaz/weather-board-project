import { useId } from 'react';

import type { Coordinates } from '@/shared/api/weather-contract';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';
import { SpinnerIcon } from '@/shared/ui/icons';

import { selectSource, useWeather } from '../api/weatherQuery';
import { formatViewerTime } from '../lib/format';

export const MANUAL_REFRESH_COOLDOWN_SECONDS = 10;

/**
 * Manual refresh, throttled to once per 10 s. Uses aria-disabled (not `disabled`) so focus
 * stays on the button through refresh and cooldown. Feedback: spinner + "Refreshing…",
 * then a polite "Updated 14:05" status, and a countdown until it can be pressed again.
 */
export function RefreshButton({ coordinates }: { coordinates: Coordinates }) {
  // Subscribes to a tiny slice; re-renders on fetch state changes only.
  const { refetch, isFetching, isError, data, dataUpdatedAt } = useWeather(
    coordinates,
    selectSource,
  );
  const { remaining, start } = useCountdown();
  const hintId = useId();

  const coolingDown = remaining > 0;
  const blocked = isFetching || coolingDown;

  const refresh = () => {
    if (blocked) return;
    start(MANUAL_REFRESH_COOLDOWN_SECONDS);
    void refetch();
  };

  let status = '';
  if (isFetching) status = 'Refreshing…';
  else if (isError && data !== undefined)
    status = `Couldn’t refresh. Showing data from ${formatViewerTime(dataUpdatedAt)}.`;
  else if (dataUpdatedAt > 0) status = `Updated ${formatViewerTime(dataUpdatedAt)}`;

  return (
    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
      <Button
        variant="secondary"
        onClick={refresh}
        aria-disabled={blocked}
        aria-describedby={coolingDown ? hintId : undefined}
        className={cn(blocked && 'cursor-not-allowed opacity-60')}
      >
        {isFetching && <SpinnerIcon className="animate-spin" />}
        {isFetching ? 'Refreshing…' : 'Refresh'}
      </Button>
      <p role="status" className="text-xs text-fg-muted">
        {status}
      </p>
      {coolingDown && !isFetching && (
        // Not a live region: a per-second countdown must not be announced every tick.
        <p id={hintId} className="numeric text-xs text-fg-muted">
          Refresh again in {remaining}s
        </p>
      )}
    </div>
  );
}
