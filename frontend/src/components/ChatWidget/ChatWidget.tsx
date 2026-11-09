'use client';

/**
 * components/ChatWidget/ChatWidget.tsx
 * The chat assistant in the bottom-right corner, fronted by an animated 3D robot (Robot3D.tsx).
 * - First visit in a browser session: the robot walks in, waves, and a speech bubble says hello in a few lines.
 * - Afterwards it roams left and right (side view, natural walk cycle). At each stop it either talks to the
 *   visitor or performs a move (dance, karate, flex, robot dance, star jumps, spin) with a matching line.
 * - Every time the guestbook's Send note button comes into view, it drops what it's doing, walks over,
 *   points its finger at the button with a dashed guide line, tells the visitor to try it for a few
 *   seconds, then carries on. It stops doing this once the visitor has sent a note.
 * - Clicking the robot (or the bubble) opens a chat panel with quick topics and a question box.
 * - Answers come from lib/chat-answers.ts, built only from your profile; later an AI can answer instead.
 * The panel is a non-modal dialog: the page stays usable, and Escape closes it.
 * Used by: app/layout.tsx.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { site } from '@/content/site';
import { answerQuestion, greetingText, QUICK_QUESTIONS } from '@/lib/chat-answers';
import { GUIDE_HIGHLIGHT_ATTR, NOTE_SENT_EVENT, SEND_NOTE_SELECTOR } from '@/lib/guide';
import { scrollToElement } from '@/lib/scroll';
import {
  distance,
  facingToward,
  nearestPointOnRect,
  pointAlong,
  pointingAngle,
  rectCenter,
  type Point,
} from '@/lib/robot-geometry';
import { Robot3D, type RobotAct, type RobotFacing, type RobotPhase } from './Robot3D';
import styles from './ChatWidget.module.css';

/** Pause after the page opens before the robot walks in, so it doesn't compete with the page loading. */
export const ARRIVE_DELAY_MS = 800;
/** How long the walk-in takes. */
export const WALK_MS = 1600;
/** How long each greeting line stays in the speech bubble. */
export const LINE_MS = 2200;
/** Short pause before an answer, so the reply reads like a conversation instead of an instant swap. */
export const REPLY_DELAY_MS = 450;
/** sessionStorage key: the walk-in and greeting happen once per browser session, not on every page view. */
export const GREETED_KEY = 'chat-greeted';
/** Longest question accepted, matching what the future AI endpoint will allow. */
const MAX_QUESTION_LENGTH = 300;

/** What the robot says when it arrives, one line at a time. */
export const GREETING_LINES: readonly string[] = [
  `Hi! I'm ${site.name}.`,
  'How are you?',
  'Want to know about me? Click me!',
];

/** What it says, in turn, each time it stops while roaming. Edit freely. */
export const TALK_LINES: readonly string[] = [
  'Ask me about my tech stack!',
  'I build with React, Next.js and Node.js.',
  'Psst... press X for X-ray mode.',
  'Leave a note and watch it travel!',
  'Click me to chat!',
];

/** What it says while pointing at the Send note button, one line at a time. */
export const GUIDE_LINES: readonly string[] = [
  'Fill this in and hit Send note!',
  'Then watch your note travel through the stack.',
];

/**
 * Moves the robot performs at alternate stops while roaming, each with a line to say.
 * `ms` must match the animation length for that move in Robot3D.module.css.
 */
export const ACTS: ReadonlyArray<{ id: Exclude<RobotAct, 'none'>; ms: number; line: string }> = [
  { id: 'dance', ms: 2800, line: 'Check out my moves!' },
  { id: 'karate', ms: 3200, line: 'Hi-yah! Bugs, beware.' },
  { id: 'flex', ms: 2600, line: 'Full-stack strength!' },
  { id: 'robot', ms: 3000, line: 'Beep boop. Robot dance!' },
  { id: 'jump', ms: 2400, line: 'Woohoo!' },
  { id: 'spin', ms: 1800, line: 'Wheee!' },
];

/** After pointing at the Send note button, wait at least this long before pointing at it again. */
export const GUIDE_COOLDOWN_MS = 4000;

/** Roaming: how fast it walks, how far left it may go, and how long it stands and talks at each stop. */
const ROAM_SPEED_PX_PER_S = 70;
const MAX_ROAM_PX = 280;
export const STOP_MS = 3200;
/** Time for the robot's 3D turn to finish before it aims (matches the .rig transition in the CSS). */
export const TURN_MS = 500;
/** Time for the arm to swing up before the guide line appears (matches point-raise in the CSS). */
const RAISE_MS = 450;

/** True when the visitor asked their system for reduced motion: then the robot stays put. */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Message = { id: number; from: 'bot' | 'visitor'; text: string };

/**
 * Once-per-session flags (the arrival greeting) in sessionStorage. Storage can throw (private mode, blocked
 * storage); then the flag reads as "not yet" and the show simply plays again, which breaks nothing.
 */
function readFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Storage blocked: nothing to remember, nothing breaks.
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  // Starts "offstage" on the server and in the browser alike, so the first render always matches.
  const [phase, setPhase] = useState<RobotPhase>('offstage');
  // What the robot is saying right now (null = quiet).
  const [speech, setSpeech] = useState<string | null>(null);
  // Roaming: horizontal offset from its home corner (negative = further left), how long the current walk
  // takes, whether it's walking, and which way it faces.
  const [offsetX, setOffsetX] = useState(0);
  const [moveMs, setMoveMs] = useState(0);
  const [moving, setMoving] = useState(false);
  const [facing, setFacing] = useState<RobotFacing>('front');
  // Guiding: true while the robot walks to the Send note button and points at it.
  const [guiding, setGuiding] = useState(false);
  // Arm angle while pointing (null = not pointing).
  const [pointAngle, setPointAngle] = useState<number | null>(null);
  // The move it's performing right now ('none' = no move).
  const [act, setAct] = useState<RobotAct>('none');
  // The dashed guide line from the fingertip to the button, in screen pixels (null = hidden).
  const [guideLine, setGuideLine] = useState<{ from: Point; to: Point } | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: 'bot', text: greetingText() }]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);

  const nextId = useRef(1); // id for the next message
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  // The latest offset, readable inside timers without restarting them.
  const offsetRef = useRef(0);
  // Set when the visitor dismisses the bubble: the robot keeps roaming but stops talking.
  const quietRef = useRef(false);
  // Latest `open`, readable inside the visibility observer without re-creating it.
  const openRef = useRef(false);
  // True once the visitor has sent a note: no need to point at the button any more.
  const noteSentRef = useRef(false);
  // Latest `guiding`, and when the last guide ended (for the cooldown), readable inside the observer.
  const guidingRef = useRef(false);
  const lastGuideEndRef = useRef(0);
  const panelId = useId();
  const titleId = useId();
  const inputId = useId();

  // The arrival show: walk in, wave while the bubble says each line, then settle into idle.
  // Returning visitors in the same session skip straight to idle.
  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));

    if (readFlag(GREETED_KEY)) {
      at(0, () => setPhase('idle'));
    } else {
      const greetAt = ARRIVE_DELAY_MS + WALK_MS;
      at(ARRIVE_DELAY_MS, () => setPhase('walking'));
      at(greetAt, () => {
        setPhase('greeting');
        setFlag(GREETED_KEY);
      });
      GREETING_LINES.forEach((line, index) => {
        at(greetAt + index * LINE_MS, () => {
          if (!quietRef.current) setSpeech(line);
        });
      });
      at(greetAt + GREETING_LINES.length * LINE_MS, () => setPhase('idle'));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  // Roaming: once idle (and while the chat is closed) the robot walks to a spot, stops and says a line,
  // then walks somewhere else. It alternates between the left and right halves of its range, so every
  // walk is a real trip. Skipped entirely for visitors who prefer reduced motion.
  useEffect(() => {
    if (phase !== 'idle' || open || guiding || prefersReducedMotion()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let lineIndex = 0;
    let stopCount = 0;
    let lastAct = '';
    const after = (ms: number, run: () => void) => {
      timer = setTimeout(() => {
        if (!cancelled) run();
      }, ms);
    };

    const walk = () => {
      setSpeech(null);
      setAct('none');
      // Never wander further than the screen allows (phones get a shorter range).
      const range = Math.max(0, Math.min(MAX_ROAM_PX, window.innerWidth - 170));
      const current = offsetRef.current;
      const target =
        current < -range / 2
          ? -Math.round(Math.random() * range * 0.35) // on the left: head back right
          : -Math.round(range * (0.65 + Math.random() * 0.35)); // on the right: head left
      const ms = Math.round((Math.abs(target - current) / ROAM_SPEED_PX_PER_S) * 1000);
      setFacing(target < current ? 'left' : 'right');
      setMoveMs(ms);
      setOffsetX(target);
      offsetRef.current = target;
      setMoving(true);
      after(ms, stop);
    };

    // At each stop, turn to face the visitor, then alternate: say a line, or perform a move.
    const stop = () => {
      setMoving(false);
      setFacing('front');
      const perform = stopCount % 2 === 1;
      stopCount += 1;
      if (perform) {
        // Pick a move, never the same one twice in a row.
        const choices = ACTS.filter((move) => move.id !== lastAct);
        const move = choices[Math.floor(Math.random() * choices.length)] ?? ACTS[0]!;
        lastAct = move.id;
        setAct(move.id);
        if (!quietRef.current) setSpeech(move.line);
        after(move.ms + 200, walk);
        return;
      }
      if (!quietRef.current) {
        setSpeech(TALK_LINES[lineIndex % TALK_LINES.length] ?? null);
        lineIndex += 1;
      }
      after(STOP_MS, walk);
    };

    // Let the last greeting line be read before the first walk.
    after(STOP_MS, walk);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, open, guiding]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    guidingRef.current = guiding;
  }, [guiding]);

  // A sent note means the visitor found the form: no need to point at it after that.
  useEffect(() => {
    const onSent = () => {
      noteSentRef.current = true;
    };
    window.addEventListener(NOTE_SENT_EVENT, onSent);
    return () => window.removeEventListener(NOTE_SENT_EVENT, onSent);
  }, []);

  // Watch the guestbook. Every time the Send note button (fully) and the form (at least half) come into
  // view, start the guide, unless the chat is open, the visitor is typing in the form, a note was already
  // sent, or it pointed less than GUIDE_COOLDOWN_MS ago (stops flickering when scrolling up and down).
  useEffect(() => {
    if (phase !== 'idle' || typeof IntersectionObserver === 'undefined') return;
    const button = document.querySelector(SEND_NOTE_SELECTOR);
    const form = button?.closest('form');
    if (!button || !form) return;

    const inView = new Map<Element, boolean>();
    let wasVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          inView.set(entry.target, entry.intersectionRatio >= (entry.target === button ? 0.99 : 0.5));
        }
        const visible = Boolean(inView.get(button) && inView.get(form));
        const cameIntoView = visible && !wasVisible;
        wasVisible = visible;
        if (!cameIntoView) return;
        const busy = openRef.current || guidingRef.current || form.contains(document.activeElement);
        const tooSoon = Date.now() - lastGuideEndRef.current < GUIDE_COOLDOWN_MS;
        if (busy || tooSoon || noteSentRef.current) return;
        guidingRef.current = true;
        setGuiding(true);
      },
      { threshold: [0, 0.5, 0.99, 1] },
    );
    observer.observe(button);
    observer.observe(form);
    return () => observer.disconnect();
  }, [phase]);

  // The guide itself:
  // 1. walk along the bottom of the screen to just right of the button (side view, legs swinging),
  // 2. turn to face the button,
  // 3. raise the nearer arm so the finger points at the button, draw a dashed line from the fingertip to it,
  //    make the button pulse, and say the guide lines,
  // 4. lower the arm and go back to roaming.
  // While pointing, scrolling or resizing re-aims the arm and line, and scrolling the button away ends it.
  useEffect(() => {
    if (!guiding) return;
    const target = document.querySelector<HTMLElement>(SEND_NOTE_SELECTOR);
    const launcher = launcherRef.current;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));
    let face: 'left' | 'right' = 'left';
    let armLength = 0;
    let lineShown = false;
    let frame = 0;

    const finish = () => {
      target?.removeAttribute(GUIDE_HIGHLIGHT_ATTR);
      lastGuideEndRef.current = Date.now();
      setPointAngle(null);
      setGuideLine(null);
      setSpeech(null);
      setFacing('front');
      setGuiding(false);
    };

    /** Measures where things are on screen right now and aims the arm (and line) at the button. */
    const aim = () => {
      if (!target || !launcher) return finish();
      const button = target.getBoundingClientRect();
      if (button.bottom < 0 || button.top > window.innerHeight) return finish(); // scrolled away
      // The arm nearer the viewer does the pointing: the robot's left arm when it faces right, and vice versa.
      const near = face === 'right' ? 'left' : 'right';
      const shoulderEl = launcher.querySelector(`[data-shoulder="${near}"]`);
      const fingerEl = launcher.querySelector(`[data-part="finger-${near}"]`);
      if (!shoulderEl || !fingerEl) return finish();
      const shoulder = rectCenter(shoulderEl.getBoundingClientRect());
      // Arm length, measured once while the arm still hangs straight down.
      if (armLength === 0) armLength = distance(shoulder, rectCenter(fingerEl.getBoundingClientRect()));
      const goal = rectCenter(button);
      setPointAngle(pointingAngle(shoulder, goal, face));
      if (!lineShown) return;
      // From just past the fingertip to the edge of the button, with a small gap for the arrowhead.
      const tip = pointAlong(shoulder, goal, armLength + 4);
      const edge = nearestPointOnRect(tip, button);
      setGuideLine(distance(tip, edge) > 14 ? { from: tip, to: pointAlong(edge, tip, 6) } : null);
    };

    // Re-aim on scroll or resize, at most once per frame.
    const onViewportChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(aim);
    };

    const point = () => {
      if (!target || !launcher) return finish();
      aim();
      target.setAttribute(GUIDE_HIGHLIGHT_ATTR, 'true');
      at(RAISE_MS, () => {
        lineShown = true;
        aim();
      });
      window.addEventListener('scroll', onViewportChange, { passive: true });
      window.addEventListener('resize', onViewportChange);
      GUIDE_LINES.forEach((line, index) => at(index * LINE_MS, () => setSpeech(line)));
      at(GUIDE_LINES.length * LINE_MS + RAISE_MS, finish);
    };

    const turnToButton = () => {
      if (!target || !launcher) return finish();
      setMoving(false);
      const robot = launcher.getBoundingClientRect();
      face = facingToward(robot.left + robot.width / 2, rectCenter(target.getBoundingClientRect()).x);
      setFacing(face);
      at(prefersReducedMotion() ? 0 : TURN_MS, point);
    };

    at(0, () => {
      setSpeech(null);
      setAct('none'); // drop whatever move it was doing
      if (!target || !launcher) return finish();
      // Stand a little to the right of the button, as close as the robot's range allows.
      const button = target.getBoundingClientRect();
      const robotWidth = launcher.getBoundingClientRect().width;
      const homeCenter = window.innerWidth - 16 - robotWidth / 2;
      const range = Math.max(0, Math.min(MAX_ROAM_PX, window.innerWidth - 170));
      const goal = Math.round(Math.min(0, Math.max(-range, button.right + 60 - homeCenter)));
      const current = offsetRef.current;
      const ms = prefersReducedMotion() ? 0 : Math.round((Math.abs(goal - current) / ROAM_SPEED_PX_PER_S) * 1000);
      if (ms > 0) setFacing(goal < current ? 'left' : 'right');
      setMoveMs(ms);
      setOffsetX(goal);
      offsetRef.current = goal;
      setMoving(ms > 0);
      at(ms + 60, turnToButton);
    });

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
      target?.removeAttribute(GUIDE_HIGHLIGHT_ATTR);
    };
  }, [guiding]);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, typing, open]);

  // Put the cursor in the question box when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Cancel a pending reply if the widget unmounts.
  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  function openPanel() {
    setOpen(true);
    setSpeech(null);
    // Opening the chat ends any pointing (the guide's cleanup removes the button's pulse).
    setGuiding(false);
    setPointAngle(null);
    setGuideLine(null);
    setAct('none');
    // Walk back home to the corner, under the panel.
    setMoveMs(Math.round((Math.abs(offsetRef.current) / ROAM_SPEED_PX_PER_S) * 1000));
    setOffsetX(0);
    offsetRef.current = 0;
    setMoving(false);
    setFacing('front');
  }

  /** Hides the bubble and keeps the robot quiet for the rest of the visit. */
  function silence() {
    quietRef.current = true;
    setSpeech(null);
  }

  function closePanel() {
    setOpen(false);
    // Give keyboard focus back to the robot button that opened the panel.
    launcherRef.current?.focus();
  }

  /** Adds the visitor's question, then the answer after a short "typing" pause. */
  function ask(question: string) {
    const text = question.trim().slice(0, MAX_QUESTION_LENGTH);
    if (!text || typing) return;
    setMessages((current) => [...current, { id: nextId.current++, from: 'visitor', text }]);
    setDraft('');
    setTyping(true);
    replyTimer.current = setTimeout(() => {
      const reply = answerQuestion(text);
      setMessages((current) => [...current, { id: nextId.current++, from: 'bot', text: reply.text }]);
      setTyping(false);
    }, REPLY_DELAY_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(draft);
  }

  /** Closes the panel and takes the visitor to the guestbook, cursor in the Name field. */
  function goToDemo() {
    setOpen(false);
    scrollToElement(document.getElementById('guestbook'), 'start');
    document.querySelector<HTMLInputElement>('#guestbook input[name="name"]')?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closePanel();
    }
  }

  // Passes the walk duration to the CSS animation, so code and stylesheet can't disagree.
  const launcherStyle = { '--walk-ms': `${WALK_MS}ms` } as CSSProperties;

  return (
    <div className={styles.widget}>
      {guideLine && (
        // The dashed "look here" line from the robot's fingertip to the button. Decorative only.
        <svg className={styles.guideLine} aria-hidden="true" focusable="false">
          <defs>
            <marker id="robot-guide-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className={styles.guideArrow} />
            </marker>
          </defs>
          <line
            className={styles.guidePath}
            x1={guideLine.from.x}
            y1={guideLine.from.y}
            x2={guideLine.to.x}
            y2={guideLine.to.y}
            markerEnd="url(#robot-guide-arrow)"
          />
          <circle className={styles.guideSpark} cx={guideLine.from.x} cy={guideLine.from.y} r="4" />
        </svg>
      )}
      {open && (
        <div
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={handleKeyDown}
          data-xray-label="Client component, scripted answers for now"
        >
          <div className={styles.header}>
            <div>
              <h2 id={titleId} className={styles.title}>
                Ask about {site.name}
              </h2>
              <p className={styles.subtitle}>Answers come from {site.name}&apos;s profile.</p>
            </div>
            <button type="button" className={styles.close} onClick={closePanel} aria-label="Close chat">
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {/* role="log" + aria-live: screen readers announce each new message as it arrives. */}
          <div ref={logRef} className={styles.log} role="log" aria-live="polite">
            {messages.map((message) => (
              <p key={message.id} className={message.from === 'bot' ? styles.bot : styles.visitor}>
                <span className="visually-hidden">{message.from === 'bot' ? 'Assistant: ' : 'You: '}</span>
                {message.text}
              </p>
            ))}
            {typing && (
              <p className={`${styles.bot} ${styles.typing}`} aria-label="Assistant is typing">
                <span aria-hidden="true">...</span>
              </p>
            )}
          </div>

          <div className={styles.quick}>
            {QUICK_QUESTIONS.map((item) => (
              <button key={item.label} type="button" className={styles.chip} onClick={() => ask(item.question)}>
                {item.label}
              </button>
            ))}
            <button type="button" className={styles.chip} onClick={goToDemo}>
              Try the live demo
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className="visually-hidden" htmlFor={inputId}>
              Your question
            </label>
            <input
              ref={inputRef}
              id={inputId}
              className="input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about skills, experience, projects"
              maxLength={MAX_QUESTION_LENGTH}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary" aria-disabled={typing || !draft.trim() || undefined}>
              Ask
            </button>
          </form>
        </div>
      )}

      {/*
        The roamer carries the speech bubble and the robot together, sliding left and right.
        transition-duration matches the walk time, so the legs stop exactly when it arrives.
      */}
      <div
        className={styles.roamer}
        style={{ transform: `translateX(${offsetX}px)`, transitionDuration: `${moveMs}ms` }}
      >
        {speech && !open && (
          // The lines change every few seconds, so the bubble is hidden from screen readers;
          // the robot button's accessible name carries the same invitation once.
          <div className={styles.bubble} aria-hidden="true">
            {/* key: a new line remounts the text, replaying its small pop-in animation. */}
            <button type="button" key={speech} className={styles.bubbleText} onClick={openPanel} tabIndex={-1}>
              {speech}
            </button>
            <button type="button" className={styles.bubbleDismiss} onClick={silence} tabIndex={-1}>
              ×
            </button>
          </div>
        )}

        <button
          ref={launcherRef}
          type="button"
          className={styles.launcher}
          style={launcherStyle}
          data-phase={phase}
          onClick={() => (open ? closePanel() : openPanel())}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={open ? 'Close chat' : `Chat with ${site.name}: ask about my skills, experience and projects`}
        >
          <Robot3D
            phase={phase}
            moving={moving}
            facing={phase === 'walking' ? 'left' : facing}
            talking={speech !== null && !open}
            pointAngle={pointAngle}
            act={act}
          />
          <span className={styles.launcherLabel} aria-hidden="true">
            {open ? 'Close' : 'Chat with me'}
          </span>
        </button>
      </div>
    </div>
  );
}
