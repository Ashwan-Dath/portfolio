/**
 * hooks/usePrefersReducedMotion.ts
 * True when the visitor has asked their operating system to reduce motion (an accessibility setting
 * for people who get dizzy or distracted by animation). Animations then show their end state at once.
 * Used by: components/RequestJourney.
 */
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Tells React when the setting changes (for example, the visitor flips it while the page is open). */
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** Current value in the browser. */
function getSnapshot(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/** Value used while rendering on the server, where there is no screen: assume motion is fine. */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  // useSyncExternalStore is React's safe way to read a value that lives outside React (here, a media query).
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
