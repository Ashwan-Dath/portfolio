/**
 * components/SiteHeader/SiteHeader.tsx
 * Sticky top bar: your name (back to top), in-page navigation and the X-ray switch.
 * Server Component; only the XrayToggle inside it runs in the browser.
 * Used by: app/layout.tsx.
 */
import { site } from '@/content/site';
import { XrayToggle } from '@/xray/XrayToggle';
import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <a className={styles.logo} href="#top" data-xray-label="Root layout, Server Component">
          {site.name}
        </a>
        <nav className={styles.nav} aria-label="Main">
          <a href="#work">Work</a>
          <a href="#guestbook">Notes</a>
          <a href="#stack">Stack</a>
        </nav>
        <XrayToggle />
      </div>
    </header>
  );
}
