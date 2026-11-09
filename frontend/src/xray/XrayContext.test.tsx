/**
 * Tests for X-ray mode: the keyboard shortcut rules, the toggle, remembering the choice,
 * and surviving browsers where localStorage is blocked.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { XRAY_STORAGE_KEY } from './constants';
import { shouldToggleFromKey, XrayProvider } from './XrayContext';
import { XrayToggle } from './XrayToggle';

/** A plain key press on `target`, with optional modifier keys. */
function keyPress(key: string, target: EventTarget | null, modifiers: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) {
  return { key, target, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

function renderToggle() {
  render(
    <XrayProvider>
      <XrayToggle />
    </XrayProvider>,
  );
  return screen.getByRole('button', { name: /x-ray/i });
}

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.xray;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('shouldToggleFromKey', () => {
  // Proves the shortcut works with or without Caps Lock / Shift.
  it.each(['x', 'X'])('toggles on %s pressed on the page', (key) => {
    expect(shouldToggleFromKey(keyPress(key, document.body))).toBe(true);
  });

  // Proves typing the letter x in the guestbook or search box never flips the page.
  it('ignores typing in fields and editable areas', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const insideEditable = document.createElement('span');
    editable.append(insideEditable);
    document.body.append(input, textarea, select, editable);

    for (const target of [input, textarea, select, insideEditable]) {
      expect(shouldToggleFromKey(keyPress('x', target))).toBe(false);
    }
  });

  // Proves holding X down doesn't strobe the page (the repeats are ignored), and IME input is left alone.
  it('ignores key repeats and input-method composition', () => {
    expect(shouldToggleFromKey({ ...keyPress('x', document.body), repeat: true })).toBe(false);
    expect(shouldToggleFromKey({ ...keyPress('x', document.body), isComposing: true })).toBe(false);
  });

  // Proves browser shortcuts like Ctrl+X (cut) keep working.
  it('ignores modifier keys and other letters', () => {
    expect(shouldToggleFromKey(keyPress('x', document.body, { ctrlKey: true }))).toBe(false);
    expect(shouldToggleFromKey(keyPress('x', document.body, { metaKey: true }))).toBe(false);
    expect(shouldToggleFromKey(keyPress('x', document.body, { altKey: true }))).toBe(false);
    expect(shouldToggleFromKey(keyPress('y', document.body))).toBe(false);
  });
});

describe('XrayProvider and XrayToggle', () => {
  // Proves the switch changes the page attribute the CSS uses, and remembers the choice.
  it('the switch turns X-ray on and saves it', () => {
    const button = renderToggle();
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.xray).toBe('on');
    expect(window.localStorage.getItem(XRAY_STORAGE_KEY)).toBe('1');
  });

  // Proves the keyboard shortcut is wired up end to end (press once: on, press again: off).
  it('pressing x on the page toggles it', () => {
    const button = renderToggle();
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  // Proves a returning visitor gets X-ray back the way they left it.
  it('restores a saved choice', () => {
    window.localStorage.setItem(XRAY_STORAGE_KEY, '1');
    const button = renderToggle();
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.xray).toBe('on');
  });

  // Proves private-browsing modes that block storage still get a working switch.
  it('keeps working when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const button = renderToggle();

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.xray).toBe('on');
  });
});
