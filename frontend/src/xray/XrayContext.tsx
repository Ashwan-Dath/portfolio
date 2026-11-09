'use client';

/**
 * xray/XrayContext.tsx
 * The on/off state of X-ray mode, shared with every component through React context.
 * - The state lives in a tiny store backed by localStorage, read with useSyncExternalStore, so it is
 *   remembered between visits, stays in sync across browser tabs, and never causes a hydration mismatch.
 * - It writes data-xray="on" | "off" onto <html>; globals.css uses that to restyle the whole page.
 * - Pressing X toggles it, except while the visitor is typing in a field.
 * Used by: app/layout.tsx (provider), XrayToggle and XrayPanel (consumers).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { XRAY_STORAGE_KEY } from './constants';

export type XrayContextValue = {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
};

const XrayContext = createContext<XrayContextValue | null>(null);

/** The parts of a keyboard event this module looks at (lets tests pass plain objects). */
type KeyLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
  /** True for the automatic repeats a held-down key sends. */
  repeat?: boolean;
  /** True while an input method (e.g. for Chinese or Japanese) is composing a character. */
  isComposing?: boolean;
};

/**
 * Should this key press toggle X-ray? Only a single plain "x" or "X" counts:
 * - not a held-down key's repeats (holding X would otherwise strobe the whole page),
 * - not with Ctrl/Cmd/Alt held (those are browser shortcuts such as cut),
 * - not while an input method is composing,
 * - never while the visitor is typing in an input, textarea, select or editable area, where "x" is a letter.
 */
export function shouldToggleFromKey(event: KeyLike): boolean {
  if (event.key !== 'x' && event.key !== 'X') return false;
  if (event.repeat || event.isComposing) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target;
  if (typeof Element !== 'undefined' && target instanceof Element) {
    const typingArea = target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    if (typingArea) return false;
  }
  return true;
}

/** A minimal external store: React subscribes to it and reads snapshots with useSyncExternalStore. */
type XrayStore = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => boolean;
  set: (value: boolean) => void;
};

/** Reads the saved choice. localStorage can throw (private mode, blocked storage), so that counts as "off". */
function readStored(): boolean {
  try {
    return window.localStorage.getItem(XRAY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Creates the store. It keeps the value in memory too, so X-ray still works for the current visit
 * even when localStorage is unavailable; storage only adds "remember it next time".
 */
function createXrayStore(): XrayStore {
  let current: boolean | null = null; // null = not read from storage yet
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      // The "storage" event fires when *another tab* changes localStorage: follow it, so tabs agree.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== XRAY_STORAGE_KEY) return;
        current = event.newValue === '1';
        notify();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onStorage);
      };
    },
    getSnapshot() {
      if (current === null) current = readStored();
      return current;
    },
    set(value) {
      current = value;
      try {
        window.localStorage.setItem(XRAY_STORAGE_KEY, value ? '1' : '0');
      } catch {
        // Storage blocked: the in-memory value above still works for this visit.
      }
      notify();
    },
  };
}

/** On the server nobody has chosen anything yet: render X-ray off, then the browser catches up. */
const getServerSnapshot = () => false;

export function XrayProvider({ children }: { children: ReactNode }) {
  // One store per provider, created once (useState's initializer runs a single time).
  const [store] = useState(createXrayStore);
  const enabled = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);

  // Mirror the state onto <html data-xray>, which the CSS in globals.css reacts to.
  useEffect(() => {
    document.documentElement.dataset.xray = enabled ? 'on' : 'off';
  }, [enabled]);

  // Keyboard shortcut: X toggles, anywhere on the page (except while typing).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldToggleFromKey(event)) return;
      event.preventDefault();
      store.set(!store.getSnapshot());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  // useCallback/useMemo keep these references stable, so consumers only re-render when `enabled` changes.
  const toggle = useCallback(() => store.set(!store.getSnapshot()), [store]);
  const setEnabled = useCallback((value: boolean) => store.set(value), [store]);
  const value = useMemo(() => ({ enabled, toggle, setEnabled }), [enabled, toggle, setEnabled]);

  // React 19 lets a context object be used directly as its provider.
  return <XrayContext value={value}>{children}</XrayContext>;
}

/** Read X-ray state. Throws if used outside <XrayProvider>, which would be a wiring bug. */
export function useXray(): XrayContextValue {
  const value = useContext(XrayContext);
  if (!value) throw new Error('useXray must be used inside <XrayProvider>.');
  return value;
}
