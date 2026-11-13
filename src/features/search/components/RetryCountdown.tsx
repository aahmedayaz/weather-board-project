import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Counts down from `seconds` and calls `onRetry` at zero. Remount (via `key`) to restart.
 * The ticking number is aria-hidden: announcing every second would flood screen readers;
 * the surrounding banner announces the wait once.
 */
export function RetryCountdown({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const retry = useEffectEvent(onRetry);

  useEffect(() => {
    if (remaining <= 0) {
      retry();
      return;
    }
    const timer = setTimeout(() => {
      setRemaining((value) => value - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [remaining]);

  return (
    <span aria-hidden="true" className="numeric">
      {remaining > 0 ? `Retrying in ${String(remaining)}s…` : 'Retrying…'}
    </span>
  );
}
