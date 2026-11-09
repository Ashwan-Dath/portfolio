'use client';

/**
 * components/RequestJourney/RequestJourney.tsx
 * The timing chart under the guestbook form, drawn like a browser DevTools waterfall: one row per layer,
 * a bar showing how long that layer took, and the milliseconds on the right. While a note is in flight,
 * a scan line runs down the layers; when the answer arrives, the bars draw themselves in order,
 * replaying the request slowed down so people can follow it.
 * Used by: components/Guestbook.
 */
import type { CSSProperties } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { StageId } from '@/lib/api-types';
import { layoutStages, STAGES, stageName, type JourneyState, type StageLayout } from '@/lib/journey';
import styles from './RequestJourney.module.css';

/** How long the bars take to replay the whole request, in ms. */
const REVEAL_MS = 1400;

type StageState = 'waiting' | 'active' | 'done' | 'failed';

/** Inline style object that may also carry CSS custom properties such as --start. */
type StageStyle = CSSProperties & Record<`--${string}`, string | number>;

/** How one row should look for the current journey state. */
function stageStateFor(state: JourneyState, id: StageId): StageState {
  switch (state.status) {
    case 'idle':
      return 'waiting';
    case 'sending':
      return 'active';
    case 'done':
      return 'done';
    case 'failed': {
      // Layers before the failure were reached; the failing one is marked; later ones never ran.
      const failedIndex = STAGES.findIndex((stage) => stage.id === state.failedAt);
      const index = STAGES.findIndex((stage) => stage.id === id);
      if (index === failedIndex) return 'failed';
      return index < failedIndex ? 'done' : 'waiting';
    }
  }
}

/** Text in the right-hand column. */
function msLabel(stageState: StageState, timing: StageLayout | undefined): string {
  if (timing) return `${timing.ms} ms`;
  if (stageState === 'failed') return 'failed';
  if (stageState === 'done') return 'ok';
  return '-';
}

/** The sentence under the chart. It is also announced to screen readers when it changes. */
export function summaryText(state: JourneyState): string {
  switch (state.status) {
    case 'idle':
      return 'Send a note to trace its path through all five layers.';
    case 'sending':
      return 'Tracing your note through the stack.';
    case 'done': {
      let text = `Your note passed through ${STAGES.length} layers in ${state.totalMs} ms.`;
      if (state.coldStart) text += ' Cloud Run started up for this request.';
      if (state.simulated) text += ' Demo mode: the API timings are simulated.';
      return text;
    }
    case 'failed':
      return `Stopped at ${stageName(state.failedAt)}. ${state.message}`;
  }
}

export function RequestJourney({ state }: { state: JourneyState }) {
  const reduceMotion = usePrefersReducedMotion();
  // With reduced motion the replay time is 0, so every bar appears at once.
  const layout = state.status === 'done' ? layoutStages(state.stages, reduceMotion ? 0 : REVEAL_MS) : null;
  // A new key for each result remounts the rows, so the bars draw again for every note.
  const runKey = layout ? layout.map((stage) => stage.ms).join('-') : state.status;

  return (
    <div className={styles.journey} data-xray-label="useReducer state machine, measured timings">
      <div className={styles.head} aria-hidden="true">
        <span>Layer</span>
        <span>Time</span>
        <span>ms</span>
      </div>

      <ol key={runKey} className={styles.stages} aria-label="Request journey">
        {STAGES.map((stage, index) => {
          const stageState = stageStateFor(state, stage.id);
          const timing = layout?.[index];
          // Position and timing for this bar are passed to the CSS as custom properties.
          const style: StageStyle = { '--i': index };
          if (timing) {
            style['--start'] = `${timing.startPct}%`;
            style['--width'] = `${timing.widthPct}%`;
            style['--delay'] = `${timing.delayMs}ms`;
            style['--duration'] = `${timing.durationMs}ms`;
          }
          return (
            <li key={stage.id} className={styles.stage} data-stage={stage.id} data-state={stageState} style={style}>
              <span className={styles.label}>
                <span className={styles.name}>{stage.name}</span>
                <span className={styles.host}>{stage.host}</span>
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.bar} />
              </span>
              <span className={styles.ms}>{msLabel(stageState, timing)}</span>
              {stage.id === 'express' && state.status === 'done' && state.coldStart && (
                <span className={styles.badge}>Woke from zero</span>
              )}
            </li>
          );
        })}
      </ol>

      <p className={styles.summary} role="status" aria-live="polite">
        {summaryText(state)}
      </p>
    </div>
  );
}
