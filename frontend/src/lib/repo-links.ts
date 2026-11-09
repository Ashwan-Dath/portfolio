/**
 * lib/repo-links.ts
 * Builds links to files in this project's GitHub repository, so X-ray mode can say
 * "here is the exact code" and an engineer can click straight to it.
 * Used by: xray/XrayPanel and components/StackSection.
 */
import { site } from '@/content/site';

/**
 * GitHub URL of a file on the main branch.
 * githubFileUrl('frontend/src/app/page.tsx') → 'https://github.com/<you>/<repo>/blob/main/frontend/src/app/page.tsx'
 * Leading slashes are ignored, so '/backend/src/app.ts' works too.
 */
export function githubFileUrl(repoPath: string): string {
  const cleanPath = repoPath.replace(/^\/+/, '');
  return `${site.repoUrl}/blob/main/${encodeURI(cleanPath)}`;
}
