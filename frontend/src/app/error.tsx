'use client';

/**
 * app/error.tsx
 * Shown instead of the page if something throws while rendering it. Next.js passes the error and a
 * `reset` function that tries rendering the page again. It must be a client component.
 */
import { useEffect } from 'react';
import styles from './status-page.module.css';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Log it so it shows up in the browser console and in Vercel's logs.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>Something broke on this page.</h1>
      <p className={styles.text}>It&apos;s probably temporary. Try again, and if it keeps happening, come back in a minute.</p>
      <button type="button" className="btn btn-primary" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
