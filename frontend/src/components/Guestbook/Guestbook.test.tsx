/**
 * Tests for the guestbook: optimistic notes, the journey summary, error handling per layer,
 * safe rendering of visitor text, and the notices for demo mode and a sleeping API.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/lib/api-types';
import { XrayProvider } from '@/xray/XrayContext';
import { Guestbook } from './Guestbook';

const TIMINGS = { nextTotalMs: 300, upstreamMs: 260, expressTotalMs: 90, dbMs: 40, coldStart: false, simulated: false };

function fakeResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

function renderGuestbook(props: Partial<{ initialNotes: Note[]; backendAvailable: boolean; demo: boolean }> = {}) {
  render(
    <XrayProvider>
      <Guestbook initialNotes={[]} backendAvailable demo={false} {...props} />
    </XrayProvider>,
  );
}

/** Fills in the form and submits it. */
async function sendNote(name: string, message: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: message } });
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Send note' }).closest('form')!);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Guestbook', () => {
  // Proves the note shows instantly (optimistic), then the chart reports the whole trip.
  it('shows the note optimistically, then the journey summary', async () => {
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))));
    renderGuestbook();

    await sendNote('Ada', 'Hello there');
    // `selector: 'li p'`: while sending, the textarea still holds the same text, so match the list item only.
    expect(screen.getByText('Hello there', { selector: 'li p' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tracing your note');
    // The button keeps focus while busy (aria-disabled, not disabled).
    expect(screen.getByRole('button', { name: 'Sending' })).toHaveAttribute('aria-disabled', 'true');

    const note = { id: '9', name: 'Ada', message: 'Hello there', createdAt: '2026-10-30T10:00:00.000Z' };
    await act(async () => {
      answer(fakeResponse(201, { note, timings: TIMINGS }));
    });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/passed through 5 layers in \d+ ms/));
    expect(screen.getByText('Hello there', { selector: 'li p' })).toBeInTheDocument();
    // The form is cleared after a successful send.
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  // Proves an API refusal shows its message and marks the Express row as the failing layer.
  it('shows the API message and marks the express stage on a 429', async () => {
    const limited = { error: { code: 'RATE_LIMITED', message: 'You can leave 3 notes every 10 minutes.' }, stage: 'express' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(429, limited)));
    renderGuestbook();

    await sendNote('Ada', 'Again');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('You can leave 3 notes every 10 minutes.'));
    expect(document.querySelector('[data-stage="express"]')).toHaveAttribute('data-state', 'failed');
    // The visitor's text survives the error, so they don't have to retype it.
    expect(screen.getByLabelText('Message')).toHaveValue('Again');
  });

  // Proves "no connection at all" is blamed on the first layer, the browser.
  it('marks the browser stage when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderGuestbook();

    await sendNote('Ada', 'Offline');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("Couldn't reach the server"));
    expect(document.querySelector('[data-stage="browser"]')).toHaveAttribute('data-state', 'failed');
  });

  // Proves the form checks itself before sending anything, without flashing the "sending" state,
  // and puts the keyboard focus on the field to fix.
  it('asks for a name before sending', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderGuestbook();

    await sendNote('   ', 'Hi');

    expect(screen.getByRole('alert')).toHaveTextContent('Add your name');
    expect(screen.getByRole('status')).toHaveTextContent('Send a note to trace its path');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Proves visitor text is shown as text: HTML in a note can't inject markup.
  it("renders a note's HTML as plain text", () => {
    const note = { id: '1', name: 'Mallory', message: '<b>bold</b><script>alert(1)</script>', createdAt: '2026-10-30T10:00:00.000Z' };
    renderGuestbook({ initialNotes: [note] });

    expect(screen.getByText('<b>bold</b><script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('.note b, li b')).toBeNull();
  });

  // Proves a visitor is told why the first send may be slow after the site has been idle.
  it('says when the API is waking up', () => {
    renderGuestbook({ backendAvailable: false });
    expect(screen.getByText(/waking up/i)).toBeInTheDocument();
  });

  // Proves demo mode never pretends the sample notes and timings are real.
  it('says when it runs in demo mode', () => {
    renderGuestbook({ demo: true });
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument();
    expect(screen.getByText('Latest notes (samples)')).toBeInTheDocument();
  });
});
