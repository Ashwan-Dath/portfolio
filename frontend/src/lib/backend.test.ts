// @vitest-environment node
/**
 * Tests for lib/backend.ts: the server-side loaders must never throw, so the page always renders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_NOTES, DEMO_PROJECTS } from '@/content/demo-data';
import { getNotes, getProjects } from './backend';

const BACKEND_URL = 'https://api.example.test';
const KEY = 'k'.repeat(32);

/** The parts of a fetch Response the loaders use. */
function fakeResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const NOTE = { id: '1', name: 'Ada', message: 'Hi', createdAt: '2026-10-30T10:00:00.000Z' };

beforeEach(() => {
  vi.stubEnv('BACKEND_URL', BACKEND_URL);
  vi.stubEnv('INTERNAL_API_KEY', KEY);
  // The loaders log failures; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getNotes', () => {
  // Proves the URL, the secret header and the one-minute cache setting.
  it('returns notes on 200 and sends the internal key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, { notes: [NOTE], timings: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNotes()).resolves.toEqual([NOTE]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { next?: { revalidate?: number } }];
    expect(url).toBe(`${BACKEND_URL}/v1/guestbook?limit=20`);
    expect(new Headers(init.headers).get('X-Internal-Key')).toBe(KEY);
    expect(init.next?.revalidate).toBe(60);
  });

  // Proves demo mode: no API configured means sample notes and no network call.
  it('returns the sample notes when BACKEND_URL is empty', async () => {
    vi.stubEnv('BACKEND_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getNotes()).resolves.toEqual(DEMO_NOTES);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Proves a misconfigured server degrades to "waking up" instead of crashing the page.
  it('returns null when INTERNAL_API_KEY is missing', async () => {
    vi.stubEnv('INTERNAL_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getNotes()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Proves a slow or unreachable API (Cloud Run asleep) leaves the page renderable.
  it('returns null when fetch rejects (for example a timeout)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')));
    await expect(getNotes()).resolves.toBeNull();
  });

  // Proves an API error answer is treated as "unavailable", not as data.
  it('returns null when the status is not 2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(503, {})));
    await expect(getNotes()).resolves.toBeNull();
  });

  // Proves the runtime check rejects malformed JSON instead of passing it to the page.
  it('returns null when the body has the wrong shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, { notes: [{ id: 1 }] })));
    await expect(getNotes()).resolves.toBeNull();
  });
});

describe('getProjects', () => {
  // Proves projects are cached for five minutes.
  it('returns projects and uses revalidate 300', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, { projects: DEMO_PROJECTS, timings: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getProjects()).resolves.toEqual(DEMO_PROJECTS);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { next?: { revalidate?: number } }];
    expect(url).toBe(`${BACKEND_URL}/v1/projects`);
    expect(init.next?.revalidate).toBe(300);
  });

  // Proves demo mode serves the sample projects.
  it('returns the sample projects when BACKEND_URL is empty', async () => {
    vi.stubEnv('BACKEND_URL', '');
    await expect(getProjects()).resolves.toEqual(DEMO_PROJECTS);
  });
});
