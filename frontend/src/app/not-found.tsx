/**
 * app/not-found.tsx
 * Shown for any address that doesn't exist (HTTP 404). Server Component.
 */
import Link from 'next/link';
import styles from './status-page.module.css';

export default function NotFound() {
  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>This page doesn&apos;t exist.</h1>
      <p className={styles.text}>The link may be old or mistyped. Everything lives on the home page.</p>
      <Link className="btn btn-primary" href="/">
        Go to the home page
      </Link>
    </div>
  );
}
