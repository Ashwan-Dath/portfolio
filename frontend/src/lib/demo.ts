/**
 * lib/demo.ts
 * Demo-mode versions of the two API calls, used when BACKEND_URL is empty.
 * They wait for a simulated amount of time (so the request journey looks real), then answer in exactly
 * the same shape as the real API, with `timings.simulated: true` so the page can say the numbers are simulated.
 * Nothing is saved: in demo mode a new note only lives in the visitor's browser until they reload.
 * Used by: app/api/guestbook/route.ts and app/api/projects/route.ts.
 */
import 'server-only';

import { NextResponse } from 'next/server';
import { DEMO_PROJECTS } from '@/content/demo-data';
import type { CreateNoteResponse, Note, RelayTimings, SearchProjectsResponse } from './api-types';
import { searchDemoProjects, simulateBackendLatency, validateNoteInput, type NoteInput } from './demo-core';
import { errorResponse, NO_STORE, roundMs } from './relay';

/** Promise that resolves after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a simulated API round trip, then returns timings in the RelayTimings shape.
 * nextTotalMs is measured for real (it includes the wait), so the Next.js part of the journey is genuine.
 */
async function simulateApiCall(startedAt: number): Promise<RelayTimings> {
  const latency = simulateBackendLatency();
  await sleep(latency.upstreamMs);
  return {
    nextTotalMs: roundMs(performance.now() - startedAt),
    upstreamMs: latency.upstreamMs,
    expressTotalMs: latency.expressTotalMs,
    dbMs: latency.dbMs,
    coldStart: latency.coldStart,
    simulated: true,
  };
}

/** Demo POST /api/guestbook: validates like the API, then returns the note it would have saved. */
export async function handleDemoCreateNote(input: NoteInput, startedAt: number): Promise<Response> {
  const result = validateNoteInput(input);
  if (!result.ok) return errorResponse(400, 'VALIDATION_ERROR', result.message, 'express');

  const timings = await simulateApiCall(startedAt);
  // A bot (honeypot filled in) gets the same success answer as a person, so it learns nothing.
  const note: Note = {
    id: `demo-${Date.now()}`,
    name: result.name,
    message: result.message,
    createdAt: new Date().toISOString(),
  };
  const body: CreateNoteResponse = { note, timings };
  return NextResponse.json(body, { status: 201, headers: NO_STORE });
}

/** Demo GET /api/projects: searches the sample projects with the same word rules as the API. */
export async function handleDemoSearch(query: string, startedAt: number): Promise<Response> {
  const timings = await simulateApiCall(startedAt);
  const body: SearchProjectsResponse = { projects: searchDemoProjects(query, DEMO_PROJECTS), timings };
  return NextResponse.json(body, { status: 200, headers: NO_STORE });
}
