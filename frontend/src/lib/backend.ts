/**
 * lib/backend.ts
 * Server-side access to the Express API. The browser never calls the API directly: it calls
 * Next.js, and Next.js calls the API from the server with the secret key (a "backend for frontend").
 * Used by: the home page (initial notes and projects) and lib/relay.ts (the route handlers).
 */
import 'server-only';

import { DEMO_NOTES, DEMO_PROJECTS } from '@/content/demo-data';
import { isNote, isProject, isRecord } from './api-guards';
import type { Note, Project } from './api-types';
import { getServerEnv, isDemoMode } from './env';

/**
 * How long to wait for the API before giving up. Long enough to cover a Cloud Run cold start
 * plus Neon waking up (each about a second), short enough that a dead API doesn't hang the page.
 */
export const BACKEND_TIMEOUT_MS = 10_000;

/** Standard fetch options plus Next.js's caching option (`next.revalidate`). */
export type BackendFetchInit = RequestInit & { next?: { revalidate?: number | false } };

/**
 * fetch() against the API: adds the base URL, the X-Internal-Key header and a timeout.
 * Throws when env vars are missing or the network fails; callers decide how to handle that.
 */
export async function backendFetch(path: string, init: BackendFetchInit = {}): Promise<Response> {
  const { backendUrl, internalApiKey } = getServerEnv();
  const headers = new Headers(init.headers);
  headers.set('X-Internal-Key', internalApiKey);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  return fetch(`${backendUrl}${path}`, {
    ...init,
    headers,
    // AbortSignal.timeout cancels the request automatically after the limit.
    signal: init.signal ?? AbortSignal.timeout(BACKEND_TIMEOUT_MS),
  });
}

/**
 * Newest 20 guestbook notes for the first page render.
 * Returns sample notes in demo mode, and null when the API can't be reached, so the page
 * can show "waking up" instead of failing. It never throws.
 */
export async function getNotes(): Promise<Note[] | null> {
  if (isDemoMode()) return DEMO_NOTES;
  try {
    // revalidate: 60 means Next.js caches the answer and refreshes it at most once a minute (ISR),
    // so visitors get an instant page and the API is not hit on every visit.
    const response = await backendFetch('/v1/guestbook?limit=20', { next: { revalidate: 60 } });
    if (!response.ok) {
      console.error(`[backend] GET /v1/guestbook answered ${response.status}`);
      return null;
    }
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.notes) || !body.notes.every(isNote)) {
      console.error('[backend] GET /v1/guestbook returned an unexpected shape');
      return null;
    }
    return body.notes;
  } catch (error) {
    console.error('[backend] getNotes failed', error);
    return null;
  }
}

/**
 * All projects for the first page render, cached for 5 minutes (projects rarely change).
 * Same contract as getNotes: sample data in demo mode, null when unavailable, never throws.
 */
export async function getProjects(): Promise<Project[] | null> {
  if (isDemoMode()) return DEMO_PROJECTS;
  try {
    const response = await backendFetch('/v1/projects', { next: { revalidate: 300 } });
    if (!response.ok) {
      console.error(`[backend] GET /v1/projects answered ${response.status}`);
      return null;
    }
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.projects) || !body.projects.every(isProject)) {
      console.error('[backend] GET /v1/projects returned an unexpected shape');
      return null;
    }
    return body.projects;
  } catch (error) {
    console.error('[backend] getProjects failed', error);
    return null;
  }
}
