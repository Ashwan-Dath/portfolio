/**
 * lib/env.ts
 * Reads the server's environment variables (set in .env.local locally, or in Vercel's settings).
 * Used by: lib/backend.ts, lib/relay.ts and the page, all of which run only on the server.
 */

// Makes the build fail if this file is ever imported into code that runs in the browser,
// because INTERNAL_API_KEY is a secret and must never be shipped to visitors.
import 'server-only';

export type ServerEnv = {
  /** Express API base URL without a trailing slash. */
  backendUrl: string;
  /** Shared secret sent in the X-Internal-Key header. */
  internalApiKey: string;
};

/**
 * Demo mode is on when no API address is configured. The site then uses sample data
 * and simulated timings, so it works before the backend exists (see lib/demo.ts).
 */
export function isDemoMode(): boolean {
  return !process.env.BACKEND_URL?.trim();
}

/**
 * Returns the API settings, or throws an error naming the first missing variable.
 * It is called lazily (at request time, not when the file loads), so a missing value
 * surfaces as a handled error where it is used instead of crashing the whole build.
 */
export function getServerEnv(): ServerEnv {
  const backendUrl = process.env.BACKEND_URL?.trim();
  const internalApiKey = process.env.INTERNAL_API_KEY?.trim();
  if (!backendUrl) throw new Error('Missing env: BACKEND_URL');
  if (!internalApiKey) throw new Error('Missing env: INTERNAL_API_KEY');
  // Remove trailing slashes so `${backendUrl}${path}` never produces "//v1/...".
  return { backendUrl: backendUrl.replace(/\/+$/, ''), internalApiKey };
}
