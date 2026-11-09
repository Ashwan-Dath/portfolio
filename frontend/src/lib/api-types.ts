/**
 * lib/api-types.ts
 * The shapes of the data that travel between the browser, the Next.js server and the Express API.
 * Types only (plus one constant): nothing here runs on its own.
 * Used by: route handlers, server data loaders and client components.
 *
 * The first block must stay identical to backend/src/types.ts once the backend exists,
 * because both apps read and write the same JSON.
 */

// ---------- Shared with the Express API (keep in sync with backend/src/types.ts) ----------

/** One guestbook note. `id` is a string because PostgreSQL bigint IDs can exceed JavaScript's safe integers. */
export type Note = {
  id: string;
  name: string;
  message: string;
  /** ISO 8601 timestamp, for example "2026-10-30T10:00:00.000Z". */
  createdAt: string;
};

/** One portfolio project, as shown in the Work section. */
export type Project = {
  /** URL-safe unique key, for example "this-portfolio". */
  slug: string;
  title: string;
  summary: string;
  /** Technologies used, shown as chips and used by search. */
  tech: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  year: number;
};

/** Timings the Express API measures itself and returns with every response. */
export type ServerTimings = {
  /** Time from the request reaching Express to the response leaving it. */
  totalMs: number;
  /** Part of totalMs spent waiting for PostgreSQL. */
  dbMs: number;
  /** True on the first request a fresh Cloud Run container handles (it had to start up). */
  coldStart: boolean;
};

/** Machine-readable error codes. The browser shows `message`; code is for logic and logs. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INTERNAL'
  | 'UPSTREAM_UNAVAILABLE';

/** Every error response from either app has this shape. */
export type ApiError = { error: { code: ErrorCode; message: string } };

/** Length limits for a guestbook note. The database columns use the same numbers. */
export const GUESTBOOK_LIMITS = { nameMax: 40, messageMax: 280 } as const;

// ---------- Frontend only ----------

/** The five layers a guestbook note passes through, in order. */
export type StageId = 'browser' | 'nextjs' | 'network' | 'express' | 'postgres';

/**
 * Timings the Next.js route handler returns to the browser: the API's own numbers plus what Next.js measured.
 * The browser adds its own round trip on top to split the journey into stages (see lib/journey.ts).
 */
export type RelayTimings = {
  /** Whole time the Next.js route handler spent on the request. */
  nextTotalMs: number;
  /** Time Next.js waited for the API (network both ways + Express). */
  upstreamMs: number;
  /** ServerTimings.totalMs from Express. */
  expressTotalMs: number;
  /** ServerTimings.dbMs from Express. */
  dbMs: number;
  coldStart: boolean;
  /** True in demo mode, where the API part is simulated. The UI says so next to the numbers. */
  simulated: boolean;
};

/** Error from a Next.js route handler. `stage` says which layer failed, so the journey can mark it. */
export type RelayError = ApiError & { stage?: StageId };

/** Successful POST /api/guestbook response. */
export type CreateNoteResponse = { note: Note; timings: RelayTimings };

/** Successful GET /api/projects response. */
export type SearchProjectsResponse = { projects: Project[]; timings: RelayTimings };
