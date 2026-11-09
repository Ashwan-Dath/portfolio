/**
 * lib/demo-core.ts
 * Pure helpers for demo mode (no BACKEND_URL): fake API latency, project search and note validation.
 * "Pure" means no network, no globals and no side effects: same input, same output. That makes them
 * easy to test, and they mirror what the real Express API will do so demo mode behaves like the real thing.
 * Used by: lib/demo.ts.
 */
import { GUESTBOOK_LIMITS, type Project } from './api-types';

/** The part of the journey that the real API would add, invented for demo mode. */
export type SimulatedLatency = {
  /** Total wait for the "API": network both ways + Express (+ a cold start sometimes). */
  upstreamMs: number;
  /** Time "inside Express", including the database. */
  expressTotalMs: number;
  /** Time "inside PostgreSQL". */
  dbMs: number;
  coldStart: boolean;
};

/**
 * Invents realistic API timings. `random` is injectable so tests can pass a fixed number.
 * Ranges are based on a small Node API on Cloud Run talking to Neon in a nearby region:
 * database 3 to 14 ms, Express adds 6 to 20 ms, the network round trip adds 60 to 170 ms, and about one
 * request in five pays a 0.9 to 1.2 s cold start while Cloud Run starts a container.
 */
export function simulateBackendLatency(random: () => number = Math.random): SimulatedLatency {
  const dbMs = Math.round(3 + random() * 11);
  const expressTotalMs = dbMs + Math.round(6 + random() * 14);
  const coldStart = random() >= 0.8;
  const networkMs = Math.round(60 + random() * 110);
  const coldStartMs = coldStart ? Math.round(900 + random() * 300) : 0;
  return { dbMs, expressTotalMs, upstreamMs: expressTotalMs + networkMs + coldStartMs, coldStart };
}

/** Every lowercase word in a piece of text: runs of letters and digits in any language. */
function toWords(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Splits a search box value into search words: at most 8 words of at most 32 characters,
 * so a pasted essay can't produce a huge query. The API's PostgreSQL search uses the same rules.
 * "  React  hooks!! " → ["react", "hooks"]
 */
export function toSearchTokens(input: string): string[] {
  return toWords(input)
    .slice(0, 8)
    .map((word) => word.slice(0, 32));
}

/**
 * Finds projects where every search word is the start of some word in the title, summary or tech list,
 * so "post" finds "PostgreSQL" and "react post" needs both. An empty query returns everything.
 */
export function searchDemoProjects(query: string, projects: readonly Project[]): Project[] {
  const tokens = toSearchTokens(query);
  if (tokens.length === 0) return [...projects];
  return projects.filter((project) => {
    const words = toWords(`${project.title} ${project.summary} ${project.tech.join(' ')}`);
    return tokens.every((token) => words.some((word) => word.startsWith(token)));
  });
}

/** What a visitor might send. Values are `unknown` because they come straight from JSON. */
export type NoteInput = { name?: unknown; message?: unknown; website?: unknown };

export type NoteValidation =
  | { ok: true; name: string; message: string; isBot: boolean }
  | { ok: false; message: string };

/**
 * Checks a note the way the API will: both fields required, trimmed, within the length limits.
 * `website` is a hidden "honeypot" field that people never see; bots fill in every field, so a
 * value there marks the sender as a bot.
 */
export function validateNoteInput(input: NoteInput): NoteValidation {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!name) return { ok: false, message: 'Name is required.' };
  if (name.length > GUESTBOOK_LIMITS.nameMax) {
    return { ok: false, message: `Name is too long (${GUESTBOOK_LIMITS.nameMax} characters max).` };
  }
  if (!message) return { ok: false, message: 'Message is required.' };
  if (message.length > GUESTBOOK_LIMITS.messageMax) {
    return { ok: false, message: `Message is too long (${GUESTBOOK_LIMITS.messageMax} characters max).` };
  }
  const isBot = typeof input.website === 'string' && input.website.trim() !== '';
  return { ok: true, name, message, isBot };
}
