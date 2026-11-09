/**
 * hooks/useProjectSearch.ts
 * Searches projects as the visitor types: waits for a pause, calls GET /api/projects, cancels requests
 * that are out of date, and never lets an old, slow answer replace a newer one.
 * Used by: components/ProjectSearch.
 */
import { useEffect, useState } from 'react';
import { isSearchProjectsResponse, isRelayError } from '@/lib/api-guards';
import type { Project, RelayTimings } from '@/lib/api-types';
import { useDebouncedValue } from './useDebouncedValue';

/** How long typing must pause before a search is sent. */
export const SEARCH_DEBOUNCE_MS = 250;

export type SearchState = {
  /** idle = empty box (showing everything), loading = waiting for an answer, then success or error. */
  status: 'idle' | 'loading' | 'success' | 'error';
  projects: Project[];
  timings: RelayTimings | null;
  error: string | null;
};

/** The last answer that came back, remembered together with the query it answers. */
type Settled = { query: string; projects: Project[]; timings: RelayTimings | null; error: string | null };

export function useProjectSearch(query: string, initialProjects: Project[]): SearchState {
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    // An empty box needs no request: the initial list is shown instead (see the return below).
    if (debounced === '') return;

    // AbortController lets us cancel this request if the visitor keeps typing.
    const controller = new AbortController();

    fetch(`/api/projects?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        // Even if an old request finishes, the cleanup below has aborted it: drop its answer.
        if (controller.signal.aborted) return;
        if (response.ok && isSearchProjectsResponse(body)) {
          setSettled({ query: debounced, projects: body.projects, timings: body.timings, error: null });
        } else {
          const message = isRelayError(body) ? body.error.message : 'Search is unavailable right now.';
          // Keep the previous results on screen so the list doesn't empty out on an error.
          setSettled((previous) => ({
            query: debounced,
            projects: previous?.projects ?? initialProjects,
            timings: null,
            error: message,
          }));
        }
      })
      .catch(() => {
        // A cancelled request rejects with AbortError: that is expected, not a failure.
        if (controller.signal.aborted) return;
        setSettled((previous) => ({
          query: debounced,
          projects: previous?.projects ?? initialProjects,
          timings: null,
          error: "Couldn't reach the server. Check your connection.",
        }));
      });

    // Runs when `debounced` changes again (or the component unmounts): cancel the now-stale request.
    return () => controller.abort();
  }, [debounced, initialProjects]);

  // The status is worked out from the data instead of stored, so it can never fall out of sync.
  if (debounced === '') return { status: 'idle', projects: initialProjects, timings: null, error: null };
  if (!settled || settled.query !== debounced) {
    // Still waiting: keep showing the last results to avoid a flash of empty content.
    return { status: 'loading', projects: settled?.projects ?? initialProjects, timings: settled?.timings ?? null, error: null };
  }
  if (settled.error) return { status: 'error', projects: settled.projects, timings: null, error: settled.error };
  return { status: 'success', projects: settled.projects, timings: settled.timings, error: null };
}
