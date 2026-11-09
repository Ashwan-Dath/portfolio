/**
 * components/Section/Section.tsx
 * A titled page section (Work, Stack) with its X-ray panel slot.
 * Server Component: it renders to plain HTML and sends no JavaScript of its own.
 * Used by: app/page.tsx.
 */
import type { ReactNode } from 'react';
import { getXrayEntry, type SectionId } from '@/xray/registry';
import { XrayPanel } from '@/xray/XrayPanel';
import styles from './Section.module.css';

type SectionProps = {
  /** Also the anchor: id="work" makes the header link #work scroll here. */
  id: SectionId;
  heading: string;
  /** True when the API isn't connected; the X-ray panel then says which layers are simulated. */
  demo: boolean;
  children: ReactNode;
};

export function Section({ id, heading, demo, children }: SectionProps) {
  const headingId = `${id}-heading`;
  return (
    // aria-labelledby names the region after its heading for screen-reader navigation.
    <section id={id} aria-labelledby={headingId} className={styles.section}>
      <div className={`container ${styles.inner}`}>
        <h2 id={headingId} className={styles.heading}>
          {heading}
        </h2>
        <XrayPanel entry={getXrayEntry(id)} demo={demo} />
        {children}
      </div>
    </section>
  );
}
