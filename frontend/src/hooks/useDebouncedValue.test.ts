/**
 * Tests for hooks/useDebouncedValue.ts.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  // Proves a new value only comes through after typing has paused for the full delay.
  it('updates only after the value has been stable for the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 'a' },
    });
    expect(result.current).toBe('a');

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  // Proves each keystroke restarts the timer, so only the last value survives.
  it('restarts the timer on every change', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 'p' },
    });
    rerender({ value: 'po' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'pos' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('p');

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('pos');
  });
});
