/**
 * lib/api-guards.ts
 * Runtime checks for JSON coming over the network. TypeScript types vanish when the code runs, so a
 * response that *claims* to be a Note could be anything. These "type guards" check the real shape
 * before the code trusts it, which turns a broken response into a clean error instead of a crash.
 * Used by: server data loaders (lib/backend.ts) and client components that call the route handlers.
 */
import type {
  ApiError,
  CreateNoteResponse,
  Note,
  Project,
  RelayError,
  RelayTimings,
  SearchProjectsResponse,
  ServerTimings,
  StageId,
} from './api-types';

const STAGE_IDS: readonly StageId[] = ['browser', 'nextjs', 'network', 'express', 'postgres'];

/** True for any non-null object, so its properties can be inspected safely. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A finite number (rejects NaN and Infinity, which JSON can't carry anyway). */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A guestbook note: id, name, message and createdAt, all strings. */
export function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.message === 'string' &&
    typeof value.createdAt === 'string'
  );
}

/** A project: text fields, a list of technology names, optional links (string or null) and a year. */
export function isProject(value: unknown): value is Project {
  return (
    isRecord(value) &&
    typeof value.slug === 'string' &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    Array.isArray(value.tech) &&
    value.tech.every((item) => typeof item === 'string') &&
    (value.repoUrl === null || typeof value.repoUrl === 'string') &&
    (value.liveUrl === null || typeof value.liveUrl === 'string') &&
    isNumber(value.year)
  );
}

/** The `timings` object Express attaches to every response. */
export function isServerTimings(value: unknown): value is ServerTimings {
  return isRecord(value) && isNumber(value.totalMs) && isNumber(value.dbMs) && typeof value.coldStart === 'boolean';
}

/** The fuller `timings` object our Next.js route handlers send to the browser. */
export function isRelayTimings(value: unknown): value is RelayTimings {
  return (
    isRecord(value) &&
    isNumber(value.nextTotalMs) &&
    isNumber(value.upstreamMs) &&
    isNumber(value.expressTotalMs) &&
    isNumber(value.dbMs) &&
    typeof value.coldStart === 'boolean' &&
    typeof value.simulated === 'boolean'
  );
}

/** Any error body: { error: { code, message } }. */
export function isApiError(value: unknown): value is ApiError {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

/** An error from our route handlers; `stage`, when present, must be one of the five layers. */
export function isRelayError(value: unknown): value is RelayError {
  if (!isApiError(value)) return false;
  const stage = (value as Record<string, unknown>).stage;
  return stage === undefined || STAGE_IDS.includes(stage as StageId);
}

/** The success body of POST /api/guestbook: the saved note plus timings. */
export function isCreateNoteResponse(value: unknown): value is CreateNoteResponse {
  return isRecord(value) && isNote(value.note) && isRelayTimings(value.timings);
}

/** The success body of GET /api/projects: matching projects plus timings. */
export function isSearchProjectsResponse(value: unknown): value is SearchProjectsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.projects) &&
    value.projects.every(isProject) &&
    isRelayTimings(value.timings)
  );
}
