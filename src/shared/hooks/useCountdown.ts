import { useCallback, useEffect, useState } from 'react';

/**
 * A whole-second countdown. `start(10)` → remaining 10, 9, … 0. Ticks only while running,
 * so an idle countdown costs nothing.
 */
export function useCountdown(): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      setRemaining((value) => value - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [remaining]);

  const start = useCallback((seconds: number) => {
    setRemaining(Math.max(0, Math.ceil(seconds)));
  }, []);

  return { remaining, start };
}
