/**
 * components/Hero/Hero.tsx
 * The first screen: who you are and the page's promise on the left, the live guestbook on the right.
 * The guestbook is the proof, so it sits in the hero instead of lower down the page.
 * Server Component; the toggle, X-ray panel and guestbook inside it are client components.
 * Used by: app/page.tsx.
 */
import { site } from '@/content/site';
import type { Note } from '@/lib/api-types';
import { getXrayEntry } from '@/xray/registry';
import { XrayPanel } from '@/xray/XrayPanel';
import { XrayToggle } from '@/xray/XrayToggle';
import { Guestbook } from '../Guestbook/Guestbook';
import styles from './Hero.module.css';

type HeroProps = {
  notes: Note[];
  backendAvailable: boolean;
  demo: boolean;
};

export function Hero({ notes, backendAvailable, demo }: HeroProps) {
  return (
    <section id="top" className={styles.hero} aria-labelledby="hero-heading">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <div className={styles.intro} data-xray-label="Server Component, rendered to HTML">
            <p className={styles.eyebrow}>
              {site.name}, {site.role}
            </p>
            <h1 id="hero-heading" className={styles.title}>
              Watch the stack run.
            </h1>
            <p className={styles.lede}>
              {/* In demo mode the API is simulated, so the page mustn't claim a running full stack yet. */}
              {demo
                ? 'A working Next.js app with a simulated API for now. Switch on X-ray to see the code behind every part.'
                : 'This site is a working full-stack app. Switch on X-ray to see the code behind every part.'}
            </p>
            <div className={styles.ctas}>
              <XrayToggle variant="cta" />
              <a className="btn btn-ghost" href="#guestbook">
                Leave a note
              </a>
            </div>
          </div>
          <XrayPanel entry={getXrayEntry('hero')} demo={demo} />
        </div>
        <Guestbook initialNotes={notes} backendAvailable={backendAvailable} demo={demo} />
      </div>
    </section>
  );
}
