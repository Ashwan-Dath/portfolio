/**
 * lib/relay.ts
 * Shared logic for the Next.js route handlers that pass browser requests on to the Express API.
 * It measures how long the API took, merges those numbers with the API's own timings, and turns
 * every kind of failure into one clear error shape that says which layer broke.
 * Used by: app/api/guestbook/route.ts, app/api/projects/route.ts and lib/demo.ts.
 */
import 'server-only';

import { NextResponse } from 'next/server';
import { isApiError, isRecord, isServerTimings } from './api-guards';
import type { ErrorCode, RelayError, RelayTimings, StageId } from './api-types';
import { backendFetch } from './backend';

/** Route handler answers are per-visitor and change constantly, so no browser or CDN may cache them. */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/** Rounds to one decimal place, e.g. 12.3456 → 12.3. Enough precision for display, smaller JSON. */
export function roundMs(ms: number): number {
  return Math.round(ms * 10) / 10;
}

/** Builds a JSON error response in the RelayError shape. */
export function errorResponse(status: number, code: ErrorCode, message: string, stage?: StageId): NextResponse {
  const body: RelayError = stage ? { error: { code, message }, stage } : { error: { code, message } };
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * The visitor's IP address, for the API's rate limit (3 notes per 10 minutes per visitor).
 * Vercel sets x-forwarded-for to "client, proxy1, proxy2" and overwrites any value a visitor sends,
 * so the first entry is trustworthy there. Returns null when neither header is present (local dev).
 */
export function getClientIp(headers: Headers): string | null {
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (first) return first;
  return headers.get('x-real-ip')?.trim() || null;
}

/**
 * Sends a request to the API and converts its answer for the browser.
 * @param path      API path, e.g. "/v1/guestbook"
 * @param init      method, headers and body to forward
 * @param startedAt performance.now() taken on the route handler's first line, to measure Next.js's own time
 *
 * Outcomes:
 * - 2xx: same body, with the API's `timings` replaced by RelayTimings (adds what Next.js measured).
 * - 400 / 413 / 429 (the visitor can fix these): passed through, tagged with stage "express".
 * - 401 or 5xx (our problem, not the visitor's): 502 tagged "express".
 * - No answer at all (timeout, DNS, missing env): 502 tagged "network".
 */
export async function relayToBackend(path: string, init: RequestInit, startedAt: number): Promise<Response> {
  const upstreamStart = performance.now();
  let upstream: Response;
  try {
    upstream = await backendFetch(path, { ...init, cache: 'no-store' });
  } catch (error) {
    console.error(`[relay] ${path} unreachable`, error);
    return errorResponse(
      502,
      'UPSTREAM_UNAVAILABLE',
      'The API is waking up or unreachable. Try again in a moment.',
      'network',
    );
  }
  const upstreamMs = performance.now() - upstreamStart;

  if (upstream.status === 401 || upstream.status >= 500) {
    if (upstream.status === 401) console.error('[relay] API rejected our key: INTERNAL_API_KEY mismatch');
    else console.error(`[relay] ${path} answered ${upstream.status}`);
    return errorResponse(502, 'UPSTREAM_UNAVAILABLE', 'The API had a problem. Try again in a moment.', 'express');
  }

  // A broken body becomes null instead of throwing, and is handled below.
  const body: unknown = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    if (isApiError(body)) {
      return NextResponse.json({ ...body, stage: 'express' }, { status: upstream.status, headers: NO_STORE });
    }
    return errorResponse(502, 'UPSTREAM_UNAVAILABLE', 'The API sent an unexpected answer.', 'express');
  }

  if (!isRecord(body) || !isServerTimings(body.timings)) {
    console.error(`[relay] ${path} returned a body without timings`);
    return errorResponse(502, 'UPSTREAM_UNAVAILABLE', 'The API sent an unexpected answer.', 'express');
  }

  // Swap the API's timings for the fuller RelayTimings; keep everything else (note / projects) as-is.
  const timings = body.timings; // typed as ServerTimings thanks to the isServerTimings check above
  const rest: Record<string, unknown> = { ...body };
  delete rest.timings;
  const relayTimings: RelayTimings = {
    nextTotalMs: roundMs(performance.now() - startedAt),
    upstreamMs: roundMs(upstreamMs),
    expressTotalMs: timings.totalMs,
    dbMs: timings.dbMs,
    coldStart: timings.coldStart,
    simulated: false,
  };
  return NextResponse.json({ ...rest, timings: relayTimings }, { status: upstream.status, headers: NO_STORE });
}
