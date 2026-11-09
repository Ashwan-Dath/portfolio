// @vitest-environment node
/**
 * Tests for POST /api/guestbook: what gets forwarded to the API, how timings are merged,
 * how every failure maps to a clear error with the failing layer, and demo mode.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const BACKEND_URL = 'https://api.example.test';
const KEY = 'k'.repeat(32);
const NOTE = { id: '7', name: 'Ada', message: 'Hi', createdAt: '2026-10-30T10:00:00.000Z' };

function post(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/guestbook', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** The parts of a fetch Response the relay uses. */
function fakeResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/guestbook with the API connected', () => {
  beforeEach(() => {
    vi.stubEnv('BACKEND_URL', BACKEND_URL);
    vi.stubEnv('INTERNAL_API_KEY', KEY);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Proves only the three note fields go upstream, with the secret key and the visitor's real IP.
  it('forwards the note fields, the key and the first x-forwarded-for IP', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse(201, { note: NOTE, timings: { totalMs: 12, dbMs: 5, coldStart: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await POST(
      post(JSON.stringify({ name: 'Ada', message: 'Hi', website: '', extra: 'dropped' }), {
        'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      }),
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BACKEND_URL}/v1/guestbook`);
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('X-Internal-Key')).toBe(KEY);
    expect(headers.get('X-Client-IP')).toBe('203.0.113.7');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Ada', message: 'Hi', website: '' });
  });

  // Proves the browser receives the API's numbers plus what Next.js measured, uncached.
  it('merges the timings on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fakeResponse(201, { note: NOTE, timings: { totalMs: 12, dbMs: 5, coldStart: true } })),
    );

    const response = await POST(post(JSON.stringify({ name: 'Ada', message: 'Hi' })));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.note).toEqual(NOTE);
    expect(body.timings).toMatchObject({ expressTotalMs: 12, dbMs: 5, coldStart: true, simulated: false });
    expect(body.timings.upstreamMs).toBeGreaterThanOrEqual(0);
    expect(body.timings.nextTotalMs).toBeGreaterThanOrEqual(body.timings.upstreamMs);
  });

  // Proves errors the visitor can act on keep their status and message.
  it('passes a 429 through with stage express', async () => {
    const limited = { error: { code: 'RATE_LIMITED', message: 'You can leave 3 notes every 10 minutes.' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(429, limited)));

    const response = await POST(post(JSON.stringify({ name: 'Ada', message: 'Hi' })));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ ...limited, stage: 'express' });
  });

  // Proves our own failures (bad key, crashes) become a generic 502 pointing at Express.
  it.each([500, 503, 401])('maps backend %i to 502 with stage express', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(status, { error: { code: 'INTERNAL', message: 'x' } })));

    const response = await POST(post(JSON.stringify({ name: 'Ada', message: 'Hi' })));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: 'UPSTREAM_UNAVAILABLE' }, stage: 'express' });
  });

  // Proves "no answer at all" points at the network between Vercel and Cloud Run.
  it('maps a timeout to 502 with stage network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')));

    const response = await POST(post(JSON.stringify({ name: 'Ada', message: 'Hi' })));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: 'UPSTREAM_UNAVAILABLE' }, stage: 'network' });
  });

  it('maps a missing INTERNAL_API_KEY to 502 with stage network', async () => {
    vi.stubEnv('INTERNAL_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(post(JSON.stringify({ name: 'Ada', message: 'Hi' })));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ stage: 'network' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Proves garbage input is rejected by Next.js (and blamed on it) before anything is sent upstream.
  it('rejects a body that is not JSON without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(post('{bad'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' }, stage: 'nextjs' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Proves a cross-site "simple" request (text/plain, no preflight) can't post notes.
  it('rejects a non-JSON content type with 415', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(post(JSON.stringify({ name: 'Ada', message: 'Hi' }), { 'content-type': 'text/plain' }));

    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Proves other websites can't make their visitors' browsers post notes here.
  it('rejects cross-site requests with 403', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(post(JSON.stringify({ name: 'Ada', message: 'Hi' }), { 'sec-fetch-site': 'cross-site' }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ stage: 'nextjs' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Proves the site's own pages are still allowed.
  it('accepts same-origin requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fakeResponse(201, { note: NOTE, timings: { totalMs: 1, dbMs: 1, coldStart: false } })),
    );

    const response = await POST(post(JSON.stringify({ name: 'Ada', message: 'Hi' }), { 'sec-fetch-site': 'same-origin' }));

    expect(response.status).toBe(201);
  });
});

describe('POST /api/guestbook in demo mode', () => {
  beforeEach(() => {
    vi.stubEnv('BACKEND_URL', '');
    // Fixed randomness: the simulated API takes 69 ms (see demo-core.test.ts).
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  // Proves demo mode answers like the real API, marked as simulated, without any network call.
  it('returns the note with simulated timings', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(post(JSON.stringify({ name: ' Ada ', message: 'Hello there' })));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.note).toMatchObject({ name: 'Ada', message: 'Hello there' });
    expect(body.timings).toMatchObject({ simulated: true, dbMs: 3, expressTotalMs: 9, upstreamMs: 69, coldStart: false });
    expect(body.timings.nextTotalMs).toBeGreaterThanOrEqual(60);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty name like the API would', async () => {
    const response = await POST(post(JSON.stringify({ name: '  ', message: 'Hi' })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR', message: 'Name is required.' } });
  });
});
