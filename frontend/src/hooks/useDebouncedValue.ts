/**
 * hooks/useDebouncedValue.ts
 * Returns a copy of `value` that only updates after `value` has stopped changing for `delayMs`.
 * Typing "postgres" quickly therefore triggers one search, not eight.
 * Used by: hooks/useProjectSearch.
 */
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Start a timer for the latest value...
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // ...and cancel it if the value changes again before it fires. Only the last value survives.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
