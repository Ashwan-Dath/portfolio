/**
 * content/demo-data.ts
 * Sample notes and projects used while the site runs in demo mode (no BACKEND_URL set).
 * Once the Express API is connected, the real notes and projects come from PostgreSQL instead,
 * and this file is only used by tests.
 *
 * TODO(you): replace the placeholder projects with your real work. When the backend is built,
 * the same entries move into backend/seed/projects.json.
 */
import type { Note, Project } from '@/lib/api-types';

/** Two example notes so the guestbook doesn't look empty in demo mode. Newest first. */
export const DEMO_NOTES: Note[] = [
  {
    id: 'demo-2',
    name: 'Meera',
    message: 'The request trace made the stack click for me. Nice work.',
    createdAt: '2026-10-28T09:12:00.000Z',
  },
  {
    id: 'demo-1',
    name: 'Daniel',
    message: 'Searching for postgres found the right project instantly.',
    createdAt: '2026-10-25T16:40:00.000Z',
  },
];

/** Projects shown in the Work section. The first one is real: it is this site. */
export const DEMO_PROJECTS: Project[] = [
  {
    slug: 'this-portfolio',
    title: 'This portfolio',
    summary:
      'Next.js front end and an Express API on Cloud Run, with PostgreSQL full-text search and a live request trace.',
    tech: ['Next.js', 'React', 'TypeScript', 'Express', 'PostgreSQL', 'Cloud Run'],
    repoUrl: null,
    liveUrl: null,
    year: 2026,
  },
  {
    slug: 'sample-booking-dashboard',
    title: 'Sample project: booking dashboard',
    summary: 'Placeholder. Replace this with a real project from your work.',
    tech: ['React', 'Node.js', 'MySQL'],
    repoUrl: null,
    liveUrl: null,
    year: 2025,
  },
  {
    slug: 'sample-payments-api',
    title: 'Sample project: payments API',
    summary: 'Placeholder. Replace this with a real project from your work.',
    tech: ['Java', 'Spring Boot', 'AWS'],
    repoUrl: null,
    liveUrl: null,
    year: 2024,
  },
];
