/**
 * components/SiteFooter/SiteFooter.tsx
 * Contact details and links at the bottom of every page. Server Component.
 * Used by: app/layout.tsx.
 */
import { site } from '@/content/site';
import styles from './SiteFooter.module.css';

// Worked out once when the page is built, not during every render.
const YEAR = new Date().getFullYear();

/** `demo`: true while the API isn't connected, so the credits don't claim Express and PostgreSQL yet. */
export function SiteFooter({ demo }: { demo: boolean }) {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.contact}>
          <p className={styles.name}>{site.name}</p>
          {/* The address is shown as text too, so it can be copied even if mail links don't open an app. */}
          <a className={styles.email} href={`mailto:${site.email}`}>
            {site.email}
          </a>
        </div>
        <ul className={styles.links}>
          <li>
            <a href={site.githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </li>
          <li>
            <a href={site.linkedinUrl} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </li>
          <li>
            <a href={site.repoUrl} target="_blank" rel="noreferrer">
              Source code
            </a>
          </li>
        </ul>
        <p className={styles.meta}>
          {YEAR}.{' '}
          {demo
            ? 'Built with Next.js. Express and PostgreSQL arrive with the API.'
            : 'Built with Next.js, Express and PostgreSQL.'}
        </p>
      </div>
    </footer>
  );
}
