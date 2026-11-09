/**
 * lib/journey.ts
 * The logic behind the Request Journey: the five layers a guestbook note passes through, how the measured
 * times split into one number per layer, how those numbers become bars on the timing chart, and a small
 * state machine (a reducer) for idle → sending → done or failed.
 * Pure TypeScript with no React, so all of it is unit-tested without rendering anything.
 * Used by: components/Guestbook and components/RequestJourney.
 */
import type { RelayTimings, StageId } from './api-types';

/** The five layers, in the order a request meets them. `host` says where each one runs. */
export const STAGES: ReadonlyArray<{ id: StageId; name: string; host: string }> = [
  { id: 'browser', name: 'Browser', host: 'React on your device' },
  { id: 'nextjs', name: 'Next.js', host: 'Route handler on Vercel' },
  { id: 'network', name: 'Network', host: 'Vercel to Cloud Run' },
  { id: 'express', name: 'Express', host: 'API on Cloud Run' },
  { id: 'postgres', name: 'PostgreSQL', host: 'Database on Neon' },
];

/** Human name of a layer, e.g. "express" → "Express". */
export function stageName(id: StageId): string {
  return STAGES.find((stage) => stage.id === id)?.name ?? id;
}

/** Everything measured for one note: the server's numbers plus the browser's own round trip. */
export type RawJourneyTimings = RelayTimings & { clientTotalMs: number };

/** Milliseconds spent in one layer. */
export type StageTiming = { id: StageId; ms: number };

/**
 * Splits nested measurements into one number per layer. Each layer measured the time *including*
 * everything after it, so each layer's own share is its total minus the next layer's total:
 *   browser  = clientTotal − nextTotal      (browser ↔ Vercel network and rendering)
 *   nextjs   = nextTotal   − upstream       (Next.js's own work)
 *   network  = upstream    − expressTotal   (Vercel ↔ Cloud Run network, plus any cold start)
 *   express  = expressTotal − db            (validation and logic in Express)
 *   postgres = db
 * Each machine measures with its own clock, so a difference can come out slightly negative;
 * those are clamped to 0. Values are rounded to whole milliseconds.
 */
export function buildJourneyBreakdown(raw: RawJourneyTimings): StageTiming[] {
  const share = (outer: number, inner: number) => Math.max(0, Math.round(outer - inner));
  return [
    { id: 'browser', ms: share(raw.clientTotalMs, raw.nextTotalMs) },
    { id: 'nextjs', ms: share(raw.nextTotalMs, raw.upstreamMs) },
    { id: 'network', ms: share(raw.upstreamMs, raw.expressTotalMs) },
    { id: 'express', ms: share(raw.expressTotalMs, raw.dbMs) },
    { id: 'postgres', ms: Math.max(0, Math.round(raw.dbMs)) },
  ];
}

/** Where one bar sits on the timing chart and how its drawing animation is timed. */
export type StageLayout = StageTiming & {
  /** Left edge, as a percentage of the chart width. */
  startPct: number;
  /** Bar width, as a percentage of the chart width. */
  widthPct: number;
  /** When this bar starts drawing, in ms after the result arrives. */
  delayMs: number;
  /** How long this bar takes to draw, in ms. */
  durationMs: number;
};

/**
 * Lays the stages end to end like a browser DevTools waterfall: each bar starts where the previous one
 * ends, and its width is its share of the total. The bars then "replay" the request in `revealMs`
 * (slowed down so people can follow it); a stage's drawing time is proportional to its real time,
 * with a 120 ms floor so tiny stages are still visible. Pass revealMs = 0 to show everything at once
 * (used when the visitor prefers reduced motion).
 */
export function layoutStages(stages: readonly StageTiming[], revealMs: number): StageLayout[] {
  const sum = stages.reduce((total, stage) => total + stage.ms, 0) || 1;
  const round2 = (value: number) => Math.round(value * 100) / 100;
  let offset = 0;
  return stages.map((stage) => {
    const startFraction = offset / sum;
    const widthFraction = stage.ms / sum;
    offset += stage.ms;
    return {
      ...stage,
      startPct: round2(startFraction * 100),
      widthPct: round2(widthFraction * 100),
      delayMs: Math.round(startFraction * revealMs),
      durationMs: revealMs === 0 ? 0 : Math.max(120, Math.round(widthFraction * revealMs)),
    };
  });
}

/** The journey's possible states. */
export type JourneyState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; stages: StageTiming[]; totalMs: number; coldStart: boolean; simulated: boolean }
  | { status: 'failed'; failedAt: StageId; message: string };

/** Events that move the journey between states. */
export type JourneyAction =
  | { type: 'send' }
  | { type: 'succeed'; raw: RawJourneyTimings }
  | { type: 'fail'; failedAt: StageId; message: string }
  | { type: 'reset' };

export const initialJourneyState: JourneyState = { status: 'idle' };

/**
 * State machine for the journey (used with React's useReducer).
 * A result is only accepted while a note is being sent; a late answer arriving in any other
 * state is ignored, which protects against out-of-order updates.
 */
export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case 'send':
      return { status: 'sending' };
    case 'succeed':
      if (state.status !== 'sending') return state;
      return {
        status: 'done',
        stages: buildJourneyBreakdown(action.raw),
        totalMs: Math.round(action.raw.clientTotalMs),
        coldStart: action.raw.coldStart,
        simulated: action.raw.simulated,
      };
    case 'fail':
      if (state.status !== 'sending') return state;
      return { status: 'failed', failedAt: action.failedAt, message: action.message };
    case 'reset':
      return initialJourneyState;
  }
}
