'use client';

/**
 * xray/XrayToggle.tsx
 * The button that switches X-ray mode on and off. Two looks:
 * - "switch" (default): compact control in the header, showing on/off and the X shortcut.
 * - "cta": the big primary button in the hero ("Switch on X-ray").
 * Used by: components/SiteHeader and components/Hero.
 */
import { useXray } from './XrayContext';
import styles from './XrayToggle.module.css';

export function XrayToggle({ variant = 'switch' }: { variant?: 'switch' | 'cta' }) {
  const { enabled, toggle } = useXray();

  if (variant === 'cta') {
    // The label itself says what will happen, so no aria-pressed is needed here.
    return (
      <button type="button" className="btn btn-primary" onClick={toggle}>
        {enabled ? 'Switch off X-ray' : 'Switch on X-ray'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={styles.switch}
      onClick={toggle}
      // aria-pressed tells screen readers this is an on/off toggle and which state it is in.
      aria-pressed={enabled}
      aria-keyshortcuts="x"
      data-xray-label="Context and an external store"
    >
      <span>X-ray</span>
      <span className={styles.state} aria-hidden="true">
        {enabled ? 'on' : 'off'}
      </span>
      <kbd className={styles.kbd}>X</kbd>
    </button>
  );
}
