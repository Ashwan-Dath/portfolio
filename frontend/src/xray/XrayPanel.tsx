'use client';

/**
 * xray/XrayPanel.tsx
 * The "how this is built" card that appears inside a page area while X-ray mode is on. Styled like the
 * title block of a technical drawing: what runs it, which React hooks and Next.js features it uses,
 * and links to the code on GitHub. Renders nothing while X-ray is off.
 * Used by: components/Section, components/Hero, components/Guestbook.
 */
import { githubFileUrl } from '@/lib/repo-links';
import { API_LAYERS, type XrayEntry } from './registry';
import { useXray } from './XrayContext';
import styles from './XrayPanel.module.css';

/** "Express, PostgreSQL and Node.js" style list. */
const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export function XrayPanel({ entry, demo }: { entry: XrayEntry | undefined; demo: boolean }) {
  const { enabled } = useXray();
  if (!enabled || !entry) return null;

  // In demo mode the API isn't connected; say plainly which layers are simulated instead of running.
  const simulatedLayers = demo ? entry.layers.filter((layer) => API_LAYERS.includes(layer)) : [];

  return (
    <aside className={styles.panel} aria-label={`How it is built: ${entry.title}`}>
      <p className={styles.title}>{entry.title}</p>
      <p className={styles.summary}>{entry.summary}</p>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Runs on</dt>
          <dd>
            <ul className={styles.chips}>
              {entry.layers.map((layer) => (
                <li key={layer}>{layer}</li>
              ))}
            </ul>
          </dd>
        </div>

        {entry.hooks.length > 0 && (
          <div className={styles.row}>
            <dt>React hooks</dt>
            <dd>
              <ul className={styles.code}>
                {entry.hooks.map((hook) => (
                  <li key={hook}>
                    <code>{hook}</code>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}

        {entry.nextFeatures.length > 0 && (
          <div className={styles.row}>
            <dt>Next.js</dt>
            <dd>{entry.nextFeatures.join(', ')}</dd>
          </div>
        )}

        <div className={styles.row}>
          <dt>Code</dt>
          <dd>
            <ul className={styles.files}>
              {entry.files.map((file) => (
                <li key={file.path}>
                  <a href={githubFileUrl(file.path)} target="_blank" rel="noreferrer">
                    {file.label}
                  </a>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      {simulatedLayers.length > 0 && (
        <p className={styles.demo}>
          Demo mode: the API isn&apos;t connected yet, so {listFormat.format(simulatedLayers)} are simulated here.
        </p>
      )}
    </aside>
  );
}
