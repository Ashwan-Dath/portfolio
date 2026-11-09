/**
 * Tests for hooks/useProjectSearch.ts, including the race that bites real search boxes:
 * an old, slow answer arriving after a newer one.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/lib/api-types';
import { SEARCH_DEBOUNCE_MS, useProjectSearch } from './useProjectSearch';

function project(slug: string): Project {
  return { slug, title: slug, summary: '', tech: [], repoUrl: null, liveUrl: null, year: 2026 };
}

const TIMINGS = { nextTotalMs: 20, upstreamMs: 15, expressTotalMs: 6, dbMs: 3, coldStart: false, simulated: false };
const INITIAL = [project('initial')];

/** A fake fetch answer that arrives after `delayMs` (fake timers), ignoring cancellation like a slow server. */
function delayedResponse(delayMs: number, status: number, body: unknown): Promise<Response> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response);
    }, delayMs);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useProjectSearch', () => {
  // Proves an empty box shows the server's list and sends nothing.
  it('returns the initial projects for an empty query without fetching', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useProjectSearch('   ', INITIAL));

    expect(result.current).toEqual({ status: 'idle', projects: INITIAL, timings: null, error: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Proves the race is handled: "re" is slow (answers at 900 ms), "react" is fast (answers at 550 ms),
  // so the stale answer arrives last. Only "react"'s results may win.
  it('aborts the previous request and keeps only the latest results', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => delayedResponse(900, 200, { projects: [project('stale')], timings: TIMINGS }))
      .mockImplementationOnce(() => delayedResponse(50, 200, { projects: [project('fresh')], timings: TIMINGS }));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ query }) => useProjectSearch(query, INITIAL), {
      initialProps: { query: 're' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('loading');

    rerender({ query: 'react' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstSignal = (fetchMock.mock.calls[0]?.[1] as RequestInit).signal;
    expect(firstSignal?.aborted).toBe(true);

    // Let both fake answers arrive (the stale one last).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.projects.map((item) => item.slug)).toEqual(['fresh']);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/projects?q=react');
  });

  // Proves a failed search reports the API's message and keeps the old results on screen.
  it('reports an error and keeps the previous projects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        delayedResponse(10, 502, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'The API is waking up.' }, stage: 'network' }),
      ),
    );

    const { result } = renderHook(() => useProjectSearch('react', INITIAL));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 20);
    });

    expect(result.current).toEqual({
      status: 'error',
      projects: INITIAL,
      timings: null,
      error: 'The API is waking up.',
    });
  });
});
