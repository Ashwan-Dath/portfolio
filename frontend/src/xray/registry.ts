/**
 * xray/registry.ts
 * What X-ray mode says about each part of the page: which layers run it, which React hooks and Next.js
 * features it uses, and which files hold the code. It is plain data, kept honest by registry.test.ts, which
 * fails if a listed file doesn't exist or a listed hook is never actually called in those files.
 * Used by: components/Section, components/Hero, components/Guestbook (through XrayPanel).
 */

/** Page areas that have an X-ray panel. */
export type SectionId = 'hero' | 'guestbook' | 'work' | 'stack';

/**
 * Technologies X-ray may name. Java, MySQL and AWS are deliberately absent: this site doesn't run them,
 * so X-ray must never claim them (they appear only in the Stack section's "Also worked with" line).
 */
export type XrayLayer =
  | 'HTML'
  | 'CSS'
  | 'TypeScript'
  | 'React'
  | 'Next.js'
  | 'Node.js'
  | 'Express'
  | 'PostgreSQL'
  | 'GCP Cloud Run'
  | 'Vercel'
  | 'GitHub Actions';

/** Layers that need the Express API. In demo mode the X-ray panel says these are simulated. */
export const API_LAYERS: readonly XrayLayer[] = ['Node.js', 'Express', 'PostgreSQL', 'GCP Cloud Run'];

export type XrayEntry = {
  id: SectionId;
  /** Short name of the part, shown as the panel's title. */
  title: string;
  /** One or two plain sentences on how it works. */
  summary: string;
  layers: XrayLayer[];
  /** React hooks called in `files`. Checked by the honesty test. */
  hooks: string[];
  nextFeatures: string[];
  /** Paths from the repository root. Each becomes a GitHub link. */
  files: Array<{ label: string; path: string }>;
};

export const xrayRegistry: XrayEntry[] = [
  {
    id: 'hero',
    title: 'Page shell and X-ray mode',
    summary:
      'The page is rendered to HTML on the server, so it shows up instantly. X-ray is a small client component that remembers your choice and listens for the X key.',
    layers: ['HTML', 'CSS', 'TypeScript', 'React', 'Next.js', 'Vercel'],
    hooks: ['useState', 'useSyncExternalStore', 'useEffect', 'useCallback', 'useMemo', 'useContext'],
    nextFeatures: ['App Router', 'Server Components', 'next/font', 'Metadata API'],
    files: [
      { label: 'Root layout', path: 'frontend/src/app/layout.tsx' },
      { label: 'X-ray state', path: 'frontend/src/xray/XrayContext.tsx' },
      { label: 'Design tokens and X-ray theme', path: 'frontend/src/app/globals.css' },
    ],
  },
  {
    id: 'guestbook',
    title: 'Guestbook and request journey',
    summary:
      'Your note appears instantly while it travels to the API. Each layer measures its own time, and the chart splits the round trip into those measurements.',
    layers: ['HTML', 'CSS', 'TypeScript', 'React', 'Next.js', 'Vercel', 'Node.js', 'Express', 'GCP Cloud Run', 'PostgreSQL'],
    hooks: ['useState', 'useOptimistic', 'useActionState', 'useReducer', 'useId', 'useRef', 'useSyncExternalStore'],
    nextFeatures: ['Route Handlers', 'Backend for frontend proxy'],
    files: [
      { label: 'Guestbook form', path: 'frontend/src/components/Guestbook/Guestbook.tsx' },
      { label: 'Timing chart', path: 'frontend/src/components/RequestJourney/RequestJourney.tsx' },
      { label: 'Journey state machine', path: 'frontend/src/lib/journey.ts' },
      { label: 'Reduced-motion hook', path: 'frontend/src/hooks/usePrefersReducedMotion.ts' },
      { label: 'Route handler', path: 'frontend/src/app/api/guestbook/route.ts' },
      { label: 'API relay and timings', path: 'frontend/src/lib/relay.ts' },
    ],
  },
  {
    id: 'work',
    title: 'Project search',
    summary:
      'Search waits until you pause typing, cancels any request that is already out of date, and asks PostgreSQL full-text search for ranked matches.',
    layers: ['React', 'Next.js', 'Express', 'PostgreSQL', 'GCP Cloud Run'],
    hooks: ['useState', 'useEffect', 'useId'],
    nextFeatures: ['Route Handlers', 'Incremental Static Regeneration for the first list'],
    files: [
      { label: 'Search component', path: 'frontend/src/components/ProjectSearch/ProjectSearch.tsx' },
      { label: 'Search hook', path: 'frontend/src/hooks/useProjectSearch.ts' },
      { label: 'Debounce hook', path: 'frontend/src/hooks/useDebouncedValue.ts' },
      { label: 'Route handler', path: 'frontend/src/app/api/projects/route.ts' },
    ],
  },
];

/** The X-ray entry for a page area, or undefined if that area has none yet. */
export function getXrayEntry(id: SectionId): XrayEntry | undefined {
  return xrayRegistry.find((entry) => entry.id === id);
}
