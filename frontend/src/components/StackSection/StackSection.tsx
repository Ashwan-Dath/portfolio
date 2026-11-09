/**
 * components/StackSection/StackSection.tsx
 * The Stack section: every skill this site demonstrates, grouped, each with one line of proof and a
 * link to where you can see it (a part of this page, or the file on GitHub). Skills from past work
 * that this site doesn't run (Java, MySQL, AWS) are listed separately, as plain text.
 * Server Component.
 * Used by: app/page.tsx.
 */
import { site } from '@/content/site';
import { githubFileUrl } from '@/lib/repo-links';
import styles from './StackSection.module.css';

export type StackGroup = 'Front end' | 'Back end' | 'Cloud and delivery';

export type StackSkill = {
  name: string;
  group: StackGroup;
  /** One line saying where the skill shows up in this project. */
  proof: string;
  /** "#section" for a part of this page, or a GitHub link. */
  href: string;
  /** Needs the Express API. In demo mode these are tagged "Arrives with the API". */
  requiresApi: boolean;
};

export const STACK_SKILLS: readonly StackSkill[] = [
  {
    name: 'HTML',
    group: 'Front end',
    proof: 'Semantic landmarks, labelled forms and a skip link on every page.',
    href: githubFileUrl('frontend/src/app/layout.tsx'),
    requiresApi: false,
  },
  {
    name: 'CSS',
    group: 'Front end',
    proof: 'Design tokens, CSS Modules and the blueprint X-ray theme, with no CSS framework.',
    href: githubFileUrl('frontend/src/app/globals.css'),
    requiresApi: false,
  },
  {
    name: 'JavaScript and TypeScript',
    group: 'Front end',
    proof: 'Strict TypeScript everywhere, with runtime checks on every API response.',
    href: githubFileUrl('frontend/src/lib/api-guards.ts'),
    requiresApi: false,
  },
  {
    name: 'React',
    group: 'Front end',
    proof: 'The guestbook uses useActionState, useOptimistic and useReducer.',
    href: '#guestbook',
    requiresApi: false,
  },
  {
    name: 'Next.js',
    group: 'Front end',
    proof: 'App Router, Server Components, route handlers and incremental static regeneration.',
    href: githubFileUrl('frontend/src/app/api/guestbook/route.ts'),
    requiresApi: false,
  },
  {
    name: 'Node.js',
    group: 'Back end',
    proof: 'Runs the API server that stores notes and answers searches.',
    href: '#guestbook',
    requiresApi: true,
  },
  {
    name: 'Express',
    group: 'Back end',
    proof: 'A validated JSON API with rate limiting and its own timing measurements.',
    href: '#guestbook',
    requiresApi: true,
  },
  {
    name: 'PostgreSQL',
    group: 'Back end',
    proof: 'Full-text search with ranking and prefix matching over the projects.',
    href: '#work',
    requiresApi: true,
  },
  {
    name: 'GCP Cloud Run',
    group: 'Cloud and delivery',
    proof: 'Hosts the API in a container that scales to zero when nobody is visiting.',
    href: '#guestbook',
    requiresApi: true,
  },
  {
    name: 'Vercel',
    group: 'Cloud and delivery',
    proof: 'Hosts this front end and rebuilds it on every push to GitHub.',
    href: '#top',
    requiresApi: false,
  },
  {
    name: 'GitHub Actions',
    group: 'Cloud and delivery',
    proof: 'Runs the tests and deploys the API on every push.',
    href: `${site.repoUrl}/actions`,
    requiresApi: true,
  },
];

const GROUPS: readonly StackGroup[] = ['Front end', 'Back end', 'Cloud and delivery'];

/** External links open in a new tab; links to parts of this page don't. */
function linkProps(href: string) {
  return href.startsWith('#') ? {} : { target: '_blank', rel: 'noreferrer' };
}

export function StackSection({ demo }: { demo: boolean }) {
  return (
    <div className={styles.stack}>
      <div className={styles.groups}>
        {GROUPS.map((group) => (
          <div key={group} className={styles.group}>
            <h3 className={styles.groupTitle}>{group}</h3>
            <ul className={styles.skills}>
              {STACK_SKILLS.filter((skill) => skill.group === group).map((skill) => (
                <li key={skill.name} className={styles.skill}>
                  <a className={styles.skillName} href={skill.href} {...linkProps(skill.href)}>
                    {skill.name}
                  </a>
                  <p className={styles.proof}>{skill.proof}</p>
                  {demo && skill.requiresApi && <span className={styles.tag}>Arrives with the API</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className={styles.also}>Also worked with: {site.alsoWorkedWith.join(', ')}</p>
    </div>
  );
}
