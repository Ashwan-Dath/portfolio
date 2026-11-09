'use client';

/**
 * components/Guestbook/Guestbook.tsx
 * The guestbook form, the request journey chart and the latest notes. This is the page's signature moment:
 * the visitor sends a note and watches it pass through every layer of the stack with real timings.
 *
 * React 19 features on show:
 * - useActionState runs the form submission and gives us `isPending` while it is in flight.
 * - useOptimistic shows the new note immediately, before the server has answered.
 * - useReducer drives the journey's state machine (lib/journey.ts).
 * Used by: components/Hero.
 */
import {
  startTransition,
  useActionState,
  useId,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { isCreateNoteResponse, isRelayError } from '@/lib/api-guards';
import { GUESTBOOK_LIMITS, type Note } from '@/lib/api-types';
import { initialJourneyState, journeyReducer, type JourneyState } from '@/lib/journey';
import { NOTE_SENT_EVENT } from '@/lib/guide';
import { scrollToElement } from '@/lib/scroll';
import { getXrayEntry } from '@/xray/registry';
import { XrayPanel } from '@/xray/XrayPanel';
import { RequestJourney } from '../RequestJourney/RequestJourney';
import styles from './Guestbook.module.css';

/** How many notes the list keeps on screen. */
const MAX_NOTES = 20;

/** Optimistic notes get a temporary id with this prefix, so they can be styled as "sending". */
const PENDING_PREFIX = 'pending-';

/** "Oct 28, 2026". A fixed time zone keeps the server's HTML and the browser's identical. */
const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Formats an ISO timestamp for the notes list; an unreadable date shows nothing instead of crashing. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}

/**
 * Name of the hidden anti-bot ("honeypot") field. Deliberately meaningless: password managers fill fields
 * called "website", "url" or "company" even when they are hidden, which would make the API silently drop a
 * real visitor's note. The JSON sent to the API still calls it `website`.
 */
const HONEYPOT_FIELD = 'hp_check';

/** What the form shows after the server answers: nothing yet, success, or the server's error message. */
type FormState = { status: 'idle' } | { status: 'success' } | { status: 'error'; message: string };

const INITIAL_FORM_STATE: FormState = { status: 'idle' };

/** A problem found before sending, tied to the field the visitor needs to fix. */
type FieldProblem = { field: 'name' | 'message'; message: string };

/** Checks the form in the browser, so an empty field never starts a request. */
function findFieldProblem(formData: FormData): FieldProblem | null {
  if (!String(formData.get('name') ?? '').trim()) {
    return { field: 'name', message: 'Add your name so people know who wrote the note.' };
  }
  if (!String(formData.get('message') ?? '').trim()) {
    return { field: 'message', message: 'Write a short message first.' };
  }
  return null;
}

type GuestbookProps = {
  /** Notes rendered by the server, newest first. */
  initialNotes: Note[];
  /** False when the server couldn't reach the API while building the page. */
  backendAvailable: boolean;
  /** True when no API is configured: timings are simulated and notes aren't saved. */
  demo: boolean;
};

export function Guestbook({ initialNotes, backendAvailable, demo }: GuestbookProps) {
  // Notes the server has confirmed.
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  // Confirmed notes plus the one being sent. React drops the optimistic note when the action ends;
  // by then the confirmed copy has been added to `notes`, so the visitor never sees it blink.
  const [optimisticNotes, addOptimisticNote] = useOptimistic(notes, (current: Note[], pending: Note) => [
    pending,
    ...current,
  ]);
  const [journey, dispatch] = useReducer(journeyReducer, initialJourneyState);

  // Controlled inputs: the component decides when the fields clear (only after a successful send),
  // and the message length drives the live character counter.
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  // A problem found before sending (empty field). Shown instead of the server's error.
  const [fieldProblem, setFieldProblem] = useState<FieldProblem | null>(null);

  // Refs let us move keyboard focus to the field that needs fixing.
  const nameRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  // The timing chart's wrapper, so a send can scroll the chart into view.
  const journeyRef = useRef<HTMLDivElement>(null);

  // useId gives unique, server-safe ids for label/input pairs and error descriptions.
  const nameId = useId();
  const messageId = useId();
  const countId = useId();
  const errorId = useId();

  /**
   * The form action. Runs after the fields have been checked (see onSubmit below); React passes the
   * previous state and the form data. Updates that happen after an `await` are wrapped in startTransition
   * so they are committed together when the action finishes.
   */
  async function submitNote(_previous: FormState, formData: FormData): Promise<FormState> {
    const nameValue = String(formData.get('name') ?? '').trim();
    const messageValue = String(formData.get('message') ?? '').trim();
    // Honeypot: hidden from people, so a value here means a bot filled in every field.
    const website = String(formData.get(HONEYPOT_FIELD) ?? '');

    dispatch({ type: 'send' });
    addOptimisticNote({
      id: `${PENDING_PREFIX}${Date.now()}`,
      name: nameValue,
      message: messageValue,
      createdAt: new Date().toISOString(),
    });

    // The browser's own stopwatch: the whole round trip as the visitor experiences it.
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue, message: messageValue, website }),
      });
    } catch {
      // fetch only rejects when no answer came back at all (offline, DNS, blocked).
      const text = "Couldn't reach the server. Check your connection and try again.";
      startTransition(() => dispatch({ type: 'fail', failedAt: 'browser', message: text }));
      return { status: 'error', message: text };
    }
    const clientTotalMs = performance.now() - startedAt;
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok || !isCreateNoteResponse(body)) {
      // The route handler says which layer failed (`stage`), so the chart can point at it.
      const relayError = isRelayError(body) ? body : null;
      const text = relayError?.error.message ?? 'Something went wrong. Try again in a moment.';
      startTransition(() => dispatch({ type: 'fail', failedAt: relayError?.stage ?? 'express', message: text }));
      return { status: 'error', message: text };
    }

    const created = body;
    startTransition(() => {
      dispatch({ type: 'succeed', raw: { ...created.timings, clientTotalMs } });
      setNotes((previous) => [created.note, ...previous].slice(0, MAX_NOTES));
      setName('');
      setMessage('');
    });
    return { status: 'success' };
  }

  const [formState, formAction, isPending] = useActionState(submitNote, INITIAL_FORM_STATE);

  // While the action runs, show the "sending" state straight away. The reducer's own updates
  // only land when the action finishes, so isPending is what makes the chart react instantly.
  const journeyView: JourneyState = isPending ? { status: 'sending' } : journey;

  // The one error to show: a field problem first, otherwise the server's answer (hidden while resending).
  const errorMessage = fieldProblem?.message ?? (!isPending && formState.status === 'error' ? formState.message : null);
  const fieldError = fieldProblem?.field;

  /**
   * Checks the fields, then hands the form data to the action. Submitting through onSubmit instead of
   * <form action> matters: React 19 automatically resets a form after an `action` prop runs, which would
   * wipe the visitor's text even when we only want to show an error.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The button stays focusable while sending (aria-disabled), so a second press is ignored here instead.
    if (isPending) return;
    const formData = new FormData(event.currentTarget);
    const problem = findFieldProblem(formData);
    setFieldProblem(problem);
    if (problem) {
      (problem.field === 'name' ? nameRef.current : messageRef.current)?.focus();
      return;
    }
    // Bring the timing chart to the middle of the screen, so the visitor watches the note travel.
    scrollToElement(journeyRef.current);
    // Tell the chat robot a note was sent, so it stops suggesting it (see lib/guide.ts).
    window.dispatchEvent(new Event(NOTE_SENT_EVENT));
    startTransition(() => formAction(formData));
  }

  return (
    <div id="guestbook" className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>Leave a note and follow it through the stack</h2>
        {demo && (
          <p className={styles.notice}>
            Demo mode: the API isn&apos;t connected yet, so the API timings are simulated and notes aren&apos;t saved.
          </p>
        )}
        {!demo && !backendAvailable && (
          <p className={styles.notice}>The guestbook API is waking up. Your note may take a few seconds.</p>
        )}
      </div>

      {/* noValidate: we show our own clear messages instead of the browser's default bubbles. */}
      <form className={styles.form} noValidate data-xray-label="useActionState and useOptimistic" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor={nameId}>
            Name
          </label>
          <input
            ref={nameRef}
            id={nameId}
            name="name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={GUESTBOOK_LIMITS.nameMax}
            autoComplete="name"
            placeholder="How should I credit you?"
            required
            aria-invalid={fieldError === 'name' || undefined}
            aria-describedby={fieldError === 'name' ? errorId : undefined}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor={messageId}>
            Message
          </label>
          <textarea
            ref={messageRef}
            id={messageId}
            name="message"
            className="input"
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={GUESTBOOK_LIMITS.messageMax}
            placeholder="Say hello, or tell me what caught your eye"
            required
            aria-invalid={fieldError === 'message' || undefined}
            aria-describedby={fieldError === 'message' ? `${countId} ${errorId}` : countId}
          />
          <p id={countId} className={styles.count}>
            {message.length} / {GUESTBOOK_LIMITS.messageMax}
          </p>
        </div>

        {/* Honeypot field: invisible and unreachable by keyboard, so only bots fill it in. */}
        <div className="visually-hidden" aria-hidden="true">
          <label htmlFor={`${nameId}-${HONEYPOT_FIELD}`}>Leave this field empty</label>
          <input
            id={`${nameId}-${HONEYPOT_FIELD}`}
            name={HONEYPOT_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        {errorMessage && (
          <p id={errorId} className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <div className={styles.actions}>
          {/*
            aria-disabled instead of disabled: a disabled button loses keyboard focus (the browser moves it to
            the page), so keyboard users would lose their place. handleSubmit ignores presses while sending.
          */}
          <button
            type="submit"
            className="btn btn-primary"
            aria-disabled={isPending || undefined}
            data-guide-target="send-note"
          >
            {isPending ? 'Sending' : 'Send note'}
          </button>
        </div>
      </form>

      <div ref={journeyRef} className={styles.journeyAnchor}>
        <RequestJourney state={journeyView} />
      </div>

      <div className={styles.notesBlock} data-xray-label={demo ? 'Sample notes in demo mode' : 'PostgreSQL, cached for 60 s'}>
        <h3 className={styles.notesTitle}>{demo ? 'Latest notes (samples)' : 'Latest notes'}</h3>
        {optimisticNotes.length === 0 ? (
          <p className={styles.empty}>No notes yet. Be the first to leave one.</p>
        ) : (
          <ul className={styles.notes}>
            {optimisticNotes.map((note) => {
              const pending = note.id.startsWith(PENDING_PREFIX);
              return (
                <li key={note.id} className={pending ? `${styles.note} ${styles.pending}` : styles.note}>
                  {/* React escapes text, so a message containing <b> or <script> shows as plain characters. */}
                  <p className={styles.message}>{note.message}</p>
                  <p className={styles.meta}>
                    {note.name},{' '}
                    {pending ? 'sending' : <time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <XrayPanel entry={getXrayEntry('guestbook')} demo={demo} />
    </div>
  );
}
