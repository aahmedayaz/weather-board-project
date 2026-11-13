import { useEffect, useState } from 'react';

/**
 * Returns `value` once it has stopped changing for `delayMs`.
 *
 * This is the one sanctioned "state set from an effect": the delay is time-based, so it
 * cannot be derived during render. Each new value cancels the pending timer, so only the
 * last value of a burst is emitted.
 */
export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
