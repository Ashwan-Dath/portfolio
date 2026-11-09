/**
 * app/api/guestbook/route.ts
 * POST /api/guestbook: the browser sends a new note here. This Next.js route handler forwards it to the
 * Express API from the server (adding the secret key and the visitor's IP for rate limiting), or answers
 * itself with simulated timings in demo mode.
 */
import type { NextRequest } from 'next/server';
import { isRecord } from '@/lib/api-guards';
import { handleDemoCreateNote } from '@/lib/demo';
import { isDemoMode } from '@/lib/env';
import { errorResponse, getClientIp, relayToBackend } from '@/lib/relay';

/**
 * Longest this function may run on Vercel, in seconds. It must outlast the 10 s API timeout
 * (lib/backend.ts) so a slow API produces our clear JSON error instead of Vercel's generic timeout page.
 */
export const maxDuration = 15;

export async function POST(request: NextRequest): Promise<Response> {
  // Start the stopwatch first, so the timing covers all of Next.js's own work.
  const startedAt = performance.now();

  // Only accept notes sent by this site's own pages. Another website could otherwise make its visitors'
  // browsers post notes here (a "cross-site" request), each with a different IP, dodging the rate limit.
  // 1) Browsers label every request with Sec-Fetch-Site; anything other than same-origin is refused.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return errorResponse(403, 'UNAUTHORIZED', 'Notes can only be sent from this site.', 'nextjs');
  }
  // 2) Requiring a JSON content type means a cross-site page can't send the note as a "simple" request,
  //    which browsers allow without asking this server first.
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'VALIDATION_ERROR', 'Send the note as JSON.', 'nextjs');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Send the note as JSON.', 'nextjs');
  }

  // Forward only the fields the API expects; anything else a client sends is dropped here.
  const input: Record<string, unknown> = isRecord(body) ? body : {};
  const note = { name: input.name, message: input.message, website: input.website };

  if (isDemoMode()) return handleDemoCreateNote(note, startedAt);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  const clientIp = getClientIp(request.headers);
  if (clientIp) headers.set('X-Client-IP', clientIp);

  return relayToBackend('/v1/guestbook', { method: 'POST', headers, body: JSON.stringify(note) }, startedAt);
}
