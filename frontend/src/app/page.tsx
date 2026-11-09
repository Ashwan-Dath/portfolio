/**
 * app/page.tsx
 * The home page (the only page). It loads the first notes and projects on the server, so they are in the
 * HTML from the start, then lays out the hero (with the guestbook), the Work section and the Stack section.
 * Server Component.
 */
import { Hero } from '@/components/Hero/Hero';
import { ProjectSearch } from '@/components/ProjectSearch/ProjectSearch';
import { Section } from '@/components/Section/Section';
import { StackSection } from '@/components/StackSection/StackSection';
import { getNotes, getProjects } from '@/lib/backend';
import { isDemoMode } from '@/lib/env';

/**
 * Incremental Static Regeneration: Next.js serves a cached copy of this page and rebuilds it in the
 * background at most once a minute. Visitors always get an instant page, even when the API is asleep.
 */
export const revalidate = 60;

export default async function HomePage() {
  const demo = isDemoMode();
  // Both requests run at the same time instead of one after the other.
  const [notes, projects] = await Promise.all([getNotes(), getProjects()]);
  // null means the API couldn't be reached; the page still renders and says it is waking up.
  const backendAvailable = notes !== null && projects !== null;

  return (
    <>
      <Hero notes={notes ?? []} backendAvailable={backendAvailable} demo={demo} />
      <Section id="work" heading="Work" demo={demo}>
        <ProjectSearch initialProjects={projects ?? []} backendAvailable={backendAvailable} demo={demo} />
      </Section>
      <Section id="stack" heading="Stack" demo={demo}>
        <StackSection demo={demo} />
      </Section>
    </>
  );
}
