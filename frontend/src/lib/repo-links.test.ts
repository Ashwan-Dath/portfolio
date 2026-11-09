/**
 * Tests for lib/repo-links.ts.
 */
import { describe, expect, it } from 'vitest';
import { site } from '@/content/site';
import { githubFileUrl } from './repo-links';

describe('githubFileUrl', () => {
  // Proves X-ray's "Code" links open the right file on GitHub's main branch.
  it('builds a link to the file on the main branch', () => {
    expect(githubFileUrl('frontend/src/app/page.tsx')).toBe(`${site.repoUrl}/blob/main/frontend/src/app/page.tsx`);
  });

  // Proves a path written with a leading slash still produces a valid link (no "//" in the URL).
  it('ignores leading slashes', () => {
    expect(githubFileUrl('/backend/src/app.ts')).toBe(`${site.repoUrl}/blob/main/backend/src/app.ts`);
  });
});
