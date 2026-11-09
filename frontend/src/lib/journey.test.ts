/**
 * Tests for lib/journey.ts: the per-layer split, the chart layout and the journey state machine.
 */
import { describe, expect, it } from 'vitest';
import {
  buildJourneyBreakdown,
  initialJourneyState,
  journeyReducer,
  layoutStages,
  type JourneyState,
  type RawJourneyTimings,
} from './journey';

const raw: RawJourneyTimings = {
  clientTotalMs: 420,
  nextTotalMs: 300,
  upstreamMs: 260,
  expressTotalMs: 90,
  dbMs: 40,
  coldStart: false,
  simulated: false,
};

describe('buildJourneyBreakdown', () => {
  // Proves each layer gets "its total minus the next layer's total", and the parts add up to the whole.
  it('splits the round trip into one number per layer', () => {
    expect(buildJourneyBreakdown(raw)).toEqual([
      { id: 'browser', ms: 120 },
      { id: 'nextjs', ms: 40 },
      { id: 'network', ms: 170 },
      { id: 'express', ms: 50 },
      { id: 'postgres', ms: 40 },
    ]);
  });

  // Proves clock differences between machines can't produce negative bars, and values are whole ms.
  it('clamps negatives to 0 and rounds', () => {
    const odd = { ...raw, clientTotalMs: 100, nextTotalMs: 120, upstreamMs: 130.4, expressTotalMs: 20, dbMs: 30.6 };
    expect(buildJourneyBreakdown(odd).map((stage) => stage.ms)).toEqual([0, 0, 110, 0, 31]);
  });
});

describe('layoutStages', () => {
  // Proves bars sit end to end like a waterfall and replay in proportion to their real time.
  it('positions bars end to end and spreads the replay over revealMs', () => {
    const layout = layoutStages(buildJourneyBreakdown(raw), 1400);
    expect(layout.map((stage) => stage.startPct)).toEqual([0, 28.57, 38.1, 78.57, 90.48]);
    expect(layout.map((stage) => stage.widthPct)).toEqual([28.57, 9.52, 40.48, 11.9, 9.52]);
    expect(layout.map((stage) => stage.delayMs)).toEqual([0, 400, 533, 1100, 1267]);
    // 40 ms of 420 is 133 ms of the replay; nothing goes below the 120 ms floor.
    expect(layout.map((stage) => stage.durationMs)).toEqual([400, 133, 567, 167, 133]);
  });

  // Proves reduced motion gets every bar at once.
  it('uses no delay and no duration when revealMs is 0', () => {
    const layout = layoutStages(buildJourneyBreakdown(raw), 0);
    expect(layout.every((stage) => stage.delayMs === 0 && stage.durationMs === 0)).toBe(true);
  });

  // Proves an all-zero result doesn't divide by zero.
  it('handles all-zero stages', () => {
    const zero = layoutStages([{ id: 'browser', ms: 0 }], 1400);
    expect(zero[0]).toMatchObject({ startPct: 0, widthPct: 0 });
  });
});

describe('journeyReducer', () => {
  // Proves the happy path: send, then a result, gives "done" with the breakdown and total.
  it('send → sending, succeed → done with stages and totalMs', () => {
    const sending = journeyReducer(initialJourneyState, { type: 'send' });
    expect(sending).toEqual({ status: 'sending' });
    const done = journeyReducer(sending, { type: 'succeed', raw: { ...raw, clientTotalMs: 419.6, simulated: true } });
    expect(done).toMatchObject({ status: 'done', totalMs: 420, coldStart: false, simulated: true });
    expect(done.status === 'done' && done.stages).toHaveLength(5);
  });

  // Proves a late or duplicate answer can't change the chart when nothing is being sent.
  it('ignores succeed and fail unless sending', () => {
    const idle: JourneyState = { status: 'idle' };
    expect(journeyReducer(idle, { type: 'succeed', raw })).toBe(idle);
    expect(journeyReducer(idle, { type: 'fail', failedAt: 'express', message: 'x' })).toBe(idle);
  });

  // Proves failures record which layer broke.
  it('fail while sending → failed at that stage', () => {
    expect(journeyReducer({ status: 'sending' }, { type: 'fail', failedAt: 'network', message: 'Timed out' })).toEqual({
      status: 'failed',
      failedAt: 'network',
      message: 'Timed out',
    });
  });

  it('reset → idle', () => {
    expect(journeyReducer({ status: 'sending' }, { type: 'reset' })).toEqual({ status: 'idle' });
  });
});
