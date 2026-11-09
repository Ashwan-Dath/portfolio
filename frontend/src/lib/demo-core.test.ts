/**
 * Tests for lib/demo-core.ts: simulated timings, search words, demo search and note validation.
 */
import { describe, expect, it } from 'vitest';
import { DEMO_PROJECTS } from '@/content/demo-data';
import { searchDemoProjects, simulateBackendLatency, toSearchTokens, validateNoteInput } from './demo-core';

describe('simulateBackendLatency', () => {
  // Proves the lowest end of every range, and no cold start.
  it('gives the minimum timings when random() is 0', () => {
    expect(simulateBackendLatency(() => 0)).toEqual({ dbMs: 3, expressTotalMs: 9, upstreamMs: 69, coldStart: false });
  });

  // Proves the top end, including a cold start: 34 (express) + 169 (network) + 1197 (cold start).
  it('gives the maximum timings and a cold start when random() is 0.99', () => {
    expect(simulateBackendLatency(() => 0.99)).toEqual({
      dbMs: 14,
      expressTotalMs: 34,
      upstreamMs: 1400,
      coldStart: true,
    });
  });
});

describe('toSearchTokens', () => {
  it.each([
    ['  React  hooks!! ', ['react', 'hooks']],
    ['Next.js', ['next', 'js']],
    ["'; DROP TABLE", ['drop', 'table']],
    ['café', ['café']],
    ['', []],
    ['!!! ---', []],
  ])('toSearchTokens(%j) → %j', (input, expected) => {
    expect(toSearchTokens(input)).toEqual(expected);
  });

  // Proves a pasted essay can't produce a huge query.
  it('keeps at most 8 words of at most 32 characters', () => {
    expect(toSearchTokens('a b c d e f g h i j')).toHaveLength(8);
    expect(toSearchTokens('x'.repeat(40))[0]).toHaveLength(32);
  });
});

describe('searchDemoProjects', () => {
  it('returns everything for an empty query', () => {
    expect(searchDemoProjects('', DEMO_PROJECTS)).toHaveLength(DEMO_PROJECTS.length);
  });

  // Proves prefix matching: "post" finds PostgreSQL.
  it('matches the start of words', () => {
    expect(searchDemoProjects('post', DEMO_PROJECTS).map((project) => project.slug)).toEqual(['this-portfolio']);
  });

  // Proves every word must match (AND), not any word (OR).
  it('requires every word to match', () => {
    expect(searchDemoProjects('react mysql', DEMO_PROJECTS).map((project) => project.slug)).toEqual([
      'sample-booking-dashboard',
    ]);
  });

  it('returns nothing when no project matches', () => {
    expect(searchDemoProjects('zzz', DEMO_PROJECTS)).toEqual([]);
  });
});

describe('validateNoteInput', () => {
  it('trims and accepts a valid note', () => {
    expect(validateNoteInput({ name: '  Ada ', message: ' Hi ' })).toEqual({
      ok: true,
      name: 'Ada',
      message: 'Hi',
      isBot: false,
    });
  });

  it.each([
    [{ name: '', message: 'x' }, 'Name is required.'],
    [{ name: 42, message: 'x' }, 'Name is required.'],
    [{ name: 'a'.repeat(41), message: 'x' }, 'Name is too long (40 characters max).'],
    [{ name: 'A', message: '   ' }, 'Message is required.'],
    [{ name: 'A', message: 'x'.repeat(281) }, 'Message is too long (280 characters max).'],
  ])('rejects %j', (input, message) => {
    expect(validateNoteInput(input)).toEqual({ ok: false, message });
  });

  // Proves the honeypot flags bots without rejecting them (they get a normal-looking answer).
  it('flags a filled-in honeypot as a bot', () => {
    expect(validateNoteInput({ name: 'A', message: 'x', website: 'spam.example' })).toMatchObject({
      ok: true,
      isBot: true,
    });
  });
});
