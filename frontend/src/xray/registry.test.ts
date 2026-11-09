// @vitest-environment node
/**
 * The X-ray honesty test. X-ray mode tells visitors which files and React hooks power each part of the page,
 * so those claims must be true: every listed file must exist, and every listed hook must actually be called
 * in those files. If someone renames a file or removes a hook, this test fails until the registry is updated.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { xrayRegistry } from './registry';

// This file lives in frontend/src/xray/, so the repository root is three folders up.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Removes /* block *\/ and // line comments, so a hook mentioned only in a comment doesn't count as used.
 * The `[^:]` guard keeps the "//" inside URLs such as https://example.com.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('xrayRegistry', () => {
  it('has unique ids', () => {
    const ids = xrayRegistry.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(xrayRegistry)('$id: lists at least one file, and every file exists', (entry) => {
    expect(entry.files.length).toBeGreaterThan(0);
    for (const file of entry.files) {
      expect(existsSync(join(repoRoot, file.path)), `${file.path} should exist`).toBe(true);
    }
  });

  it.each(xrayRegistry)('$id: every hook it claims is called in its files', (entry) => {
    const source = entry.files
      .map((file) => join(repoRoot, file.path))
      .filter((path) => existsSync(path))
      .map((path) => stripComments(readFileSync(path, 'utf8')))
      .join('\n');
    for (const hook of entry.hooks) {
      // Matches a call such as useState( or useState<Note[]>( but not just an import of the name.
      const call = new RegExp(`\\b${hook}\\s*[<(]`);
      expect(call.test(source), `${hook} should be called in ${entry.id}'s files`).toBe(true);
    }
  });
});
