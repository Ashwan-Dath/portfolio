/**
 * app/api/projects/route.ts
 * GET /api/projects?q=...: project search for the Work section. Forwards the query to the Express API
 * (which runs PostgreSQL full-text search), or searches the sample projects in demo mode.
 */
import type { NextRequest } from 'next/server';
import { handleDemoSearch } from '@/lib/demo';
import { isDemoMode } from '@/lib/env';
import { relayToBackend } from '@/lib/relay';

/** The API rejects longer queries, so cut them here instead of sending something that will fail. */
const MAX_QUERY_LENGTH = 100;

/** Longest this function may run on Vercel, in seconds: longer than the 10 s API timeout (see lib/backend.ts). */
export const maxDuration = 15;

export async function GET(request: NextRequest): Promise<Response> {
  const startedAt = performance.now();
  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);

  if (isDemoMode()) return handleDemoSearch(query, startedAt);

  // encodeURIComponent makes spaces and symbols safe inside the URL ("react hooks" → "react%20hooks").
  const path = query ? `/v1/projects?q=${encodeURIComponent(query)}` : '/v1/projects';
  return relayToBackend(path, { method: 'GET' }, startedAt);
}
