// @vitest-environment node
/**
 * Tests for GET /api/projects: query forwarding, timing merge and demo search.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_PROJECTS } from '@/content/demo-data';
import { GET } from './route';

const BACKEND_URL = 'https://api.example.test';
const KEY = 'k'.repeat(32);

function get(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/projects${query}`);
}

function fakeResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/projects with the API connected', () => {
  beforeEach(() => {
    vi.stubEnv('BACKEND_URL', BACKEND_URL);
    vi.stubEnv('INTERNAL_API_KEY', KEY);
  });

  // Proves spaces and symbols are encoded safely in the upstream URL.
  it('forwards q encoded', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse(200, { projects: [], timings: { totalMs: 4, dbMs: 2, coldStart: false } }));
    vi.stubGlobal('fetch', fetchMock);

    await GET(get('?q=react%20hooks'));

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BACKEND_URL}/v1/projects?q=react%20hooks`);
  });

  // Proves a blank search (only spaces) asks for the full list instead of searching for nothing.
  it('asks for all projects when q is empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse(200, { projects: [], timings: { totalMs: 4, dbMs: 2, coldStart: false } }));
    vi.stubGlobal('fetch', fetchMock);

    await GET(get('?q=%20%20'));

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BACKEND_URL}/v1/projects`);
  });

  // Proves the browser gets the API's projects plus the timings Next.js measured.
  it('returns projects with merged timings', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(fakeResponse(200, { projects: DEMO_PROJECTS, timings: { totalMs: 4, dbMs: 2, coldStart: false } })),
    );

    const response = await GET(get('?q=react'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects).toEqual(DEMO_PROJECTS);
    expect(body.timings).toMatchObject({ expressTotalMs: 4, dbMs: 2, simulated: false });
  });
});

describe('GET /api/projects in demo mode', () => {
  beforeEach(() => {
    vi.stubEnv('BACKEND_URL', '');
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  // Proves demo search uses the same prefix rules and is marked simulated.
  it('searches the sample projects', async () => {
    const response = await GET(get('?q=postgres'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects.map((project: { slug: string }) => project.slug)).toEqual(['this-portfolio']);
    expect(body.timings.simulated).toBe(true);
  });
});
