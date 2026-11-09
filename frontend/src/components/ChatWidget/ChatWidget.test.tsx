/**
 * Tests for the chat widget: the robot's one-time arrival and greeting, opening and closing,
 * quick topics and typed questions.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARRIVE_DELAY_MS,
  ChatWidget,
  GREETED_KEY,
  GREETING_LINES,
  GUIDE_COOLDOWN_MS,
  GUIDE_LINES,
  LINE_MS,
  REPLY_DELAY_MS,
  STOP_MS,
  TALK_LINES,
  TURN_MS,
  WALK_MS,
} from './ChatWidget';
import { NOTE_SENT_EVENT } from '@/lib/guide';

/** The robot button, found by its accessible name. */
const robot = () => screen.getByRole('button', { name: /^Chat with/ });

/** Lets the robot finish walking in, so its greeting starts. */
function arrive() {
  act(() => {
    vi.advanceTimersByTime(ARRIVE_DELAY_MS + WALK_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('ChatWidget', () => {
  // Proves the arrival show: walk in, then say each greeting line in order, remembered for the session.
  it('walks in and greets line by line, once per session', () => {
    render(<ChatWidget />);
    expect(robot()).toHaveAttribute('data-phase', 'offstage');

    act(() => {
      vi.advanceTimersByTime(ARRIVE_DELAY_MS);
    });
    expect(robot()).toHaveAttribute('data-phase', 'walking');

    act(() => {
      vi.advanceTimersByTime(WALK_MS);
    });
    expect(robot()).toHaveAttribute('data-phase', 'greeting');
    expect(screen.getByText(GREETING_LINES[0]!)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(GREETED_KEY)).toBe('1');

    act(() => {
      vi.advanceTimersByTime(LINE_MS * (GREETING_LINES.length - 1));
    });
    expect(screen.getByText(GREETING_LINES[GREETING_LINES.length - 1]!)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(LINE_MS);
    });
    expect(robot()).toHaveAttribute('data-phase', 'idle');
  });

  // Proves a returning visitor in the same session skips the show: the robot just idles, no bubble.
  it('skips the greeting later in the same session', () => {
    window.sessionStorage.setItem(GREETED_KEY, '1');
    render(<ChatWidget />);
    act(() => {
      vi.advanceTimersByTime(ARRIVE_DELAY_MS + WALK_MS + LINE_MS * 4);
    });
    expect(robot()).toHaveAttribute('data-phase', 'idle');
    expect(screen.queryByText(GREETING_LINES[0]!)).toBeNull();
  });

  // Proves the idle robot roams: it walks off (legs moving), then stops, faces the visitor and talks.
  it('walks around and talks while idle', () => {
    window.sessionStorage.setItem(GREETED_KEY, '1');
    const { container } = render(<ChatWidget />);
    const svg = () => container.querySelector('[data-robot]')!;
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(svg()).toHaveAttribute('data-moving', 'false');

    act(() => {
      vi.advanceTimersByTime(STOP_MS);
    });
    expect(svg()).toHaveAttribute('data-moving', 'true');

    // Long enough for the longest possible walk (280 px at 70 px/s = 4 s).
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(svg()).toHaveAttribute('data-moving', 'false');
    expect(svg()).toHaveAttribute('data-talking', 'true');
    expect(screen.getByText(TALK_LINES[0]!)).toBeInTheDocument();
  });

  // Proves clicking the robot opens the chat with the greeting message, and a quick topic gets an answer.
  it('opens from the robot and answers a quick topic', () => {
    render(<ChatWidget />);
    arrive();
    fireEvent.click(robot());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('Want to know about');
    // The speech bubble goes away once the chat is open.
    expect(screen.queryByText(GREETING_LINES[0]!)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tech stack' }));
    expect(screen.getByRole('log')).toHaveTextContent('What is your tech stack?');
    act(() => {
      vi.advanceTimersByTime(REPLY_DELAY_MS);
    });
    expect(screen.getByRole('log')).toHaveTextContent('Front end: HTML, CSS');
  });

  // Proves typed questions work and off-topic ones get the polite scope reply.
  it('answers a typed question and stays on topic', () => {
    render(<ChatWidget />);
    arrive();
    fireEvent.click(robot());

    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Who won the cricket match?' } });
    fireEvent.submit(screen.getByLabelText('Your question').closest('form')!);
    act(() => {
      vi.advanceTimersByTime(REPLY_DELAY_MS);
    });

    expect(screen.getByRole('log')).toHaveTextContent('I can only answer questions about');
    expect(screen.getByLabelText('Your question')).toHaveValue('');
  });

  // Proves Escape closes the panel and keyboard focus returns to the robot button.
  it('closes with Escape', () => {
    render(<ChatWidget />);
    arrive();
    fireEvent.click(robot());

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(robot()).toHaveFocus();
  });
});

describe('ChatWidget guide', () => {
  /** A stand-in IntersectionObserver the test can trigger by hand (jsdom has none). */
  let fire: (ratioFor: (target: Element) => number) => void = () => {};
  class FakeObserver {
    private targets: Element[] = [];
    private readonly callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      fire = (ratioFor) =>
        this.callback(
          this.targets.map((target) => ({ target, intersectionRatio: ratioFor(target) }) as IntersectionObserverEntry),
          this as unknown as IntersectionObserver,
        );
    }
    observe(target: Element) {
      this.targets.push(target);
    }
    disconnect() {
      this.targets = [];
    }
  }

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    // A stand-in guestbook form with the marked Send note button.
    document.body.insertAdjacentHTML(
      'beforeend',
      '<form id="fake-guestbook"><input name="name" /><button type="submit" data-guide-target="send-note">Send note</button></form>',
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.getElementById('fake-guestbook')?.remove();
  });

  // Proves that when the button and form are in view, the robot points, talks and makes the button pulse,
  // then lets go of the button when it's done.
  it('points at the Send note button when the form is in view', () => {
    window.sessionStorage.setItem(GREETED_KEY, '1');
    const { container } = render(<ChatWidget />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const button = document.querySelector('[data-guide-target="send-note"]')!;

    act(() => {
      fire(() => 1);
    });
    // Walk to the button (at most 280 px at 70 px/s = 4 s), turn to face it (0.5 s), then point.
    act(() => {
      vi.advanceTimersByTime(4000 + 60 + TURN_MS + 10);
    });
    expect(container.querySelector('[data-robot]')).toHaveAttribute('data-pointing', 'true');
    expect(button).toHaveAttribute('data-guide-highlight', 'true');
    expect(screen.getByText(GUIDE_LINES[0]!)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(LINE_MS * GUIDE_LINES.length + 500);
    });
    expect(container.querySelector('[data-robot]')).toHaveAttribute('data-pointing', 'false');
    // After pointing, it turns back to face the visitor.
    expect(container.querySelector('[data-robot]')).toHaveAttribute('data-facing', 'front');
    expect(button).not.toHaveAttribute('data-guide-highlight');
  });

  // Proves it points again each time the button comes back into view (after the short cooldown),
  // but not when the button merely stays in view.
  it('points again whenever the button comes back into view', () => {
    window.sessionStorage.setItem(GREETED_KEY, '1');
    const { container } = render(<ChatWidget />);
    const robot = () => container.querySelector('[data-robot]')!;
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // First time in view: point, then finish.
    act(() => {
      fire(() => 1);
    });
    act(() => {
      vi.advanceTimersByTime(4000 + 60 + TURN_MS + 10 + LINE_MS * GUIDE_LINES.length + 500);
    });
    expect(robot()).toHaveAttribute('data-pointing', 'false');

    // Still in view: no new trigger.
    act(() => {
      fire(() => 1);
      vi.advanceTimersByTime(TURN_MS + 100);
    });
    expect(robot()).toHaveAttribute('data-pointing', 'false');

    // Scroll away, wait out the cooldown, scroll back: it points again.
    act(() => {
      fire(() => 0);
      vi.advanceTimersByTime(GUIDE_COOLDOWN_MS);
    });
    act(() => {
      fire(() => 1);
    });
    act(() => {
      vi.advanceTimersByTime(4000 + 60 + TURN_MS + 10);
    });
    expect(robot()).toHaveAttribute('data-pointing', 'true');
  });

  // Proves a visitor who already sent a note is never pointed at.
  it('does not point after a note was sent', () => {
    window.sessionStorage.setItem(GREETED_KEY, '1');
    const { container } = render(<ChatWidget />);
    act(() => {
      vi.advanceTimersByTime(0);
      window.dispatchEvent(new Event(NOTE_SENT_EVENT));
    });

    act(() => {
      fire(() => 1);
      vi.advanceTimersByTime(5000);
    });

    expect(container.querySelector('[data-robot]')).toHaveAttribute('data-pointing', 'false');
  });
});
