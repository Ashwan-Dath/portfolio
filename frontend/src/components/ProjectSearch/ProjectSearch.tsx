'use client';

/**
 * components/ProjectSearch/ProjectSearch.tsx
 * The Work section: a search box over your projects and the results, laid out like the parts list on
 * a drawing. The first list comes from the server (already in the HTML); typing searches through
 * GET /api/projects, which asks PostgreSQL full-text search (or the sample data in demo mode).
 * Used by: app/page.tsx.
 */
import { useId, useState } from 'react';
import { useProjectSearch, type SearchState } from '@/hooks/useProjectSearch';
import type { Project } from '@/lib/api-types';
import styles from './ProjectSearch.module.css';

type ProjectSearchProps = {
  initialProjects: Project[];
  backendAvailable: boolean;
  demo: boolean;
};

/** The one-line status above the results, also announced to screen readers. */
function statusText(search: SearchState): string {
  const count = search.projects.length;
  const plural = count === 1 ? 'project' : 'projects';
  switch (search.status) {
    case 'idle':
      return `${count} ${plural}.`;
    case 'loading':
      return 'Searching.';
    case 'error':
      return search.error ?? 'Search is unavailable right now.';
    case 'success': {
      if (!search.timings) return `${count} ${plural} found.`;
      const { dbMs, nextTotalMs, simulated } = search.timings;
      const timing = `PostgreSQL answered in ${Math.round(dbMs)} ms (${Math.round(nextTotalMs)} ms on the server).`;
      return `${count} ${plural} found. ${timing}${simulated ? ' Simulated in demo mode.' : ''}`;
    }
  }
}

export function ProjectSearch({ initialProjects, backendAvailable, demo }: ProjectSearchProps) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const search = useProjectSearch(query, initialProjects);
  const trimmed = query.trim();

  return (
    <div className={styles.search}>
      <div className={styles.controls}>
        <div className="field" data-xray-label="Debounced input, stale requests cancelled">
          <label className="field-label" htmlFor={inputId}>
            Search projects
          </label>
          <input
            id={inputId}
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try react or postgres"
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
          />
        </div>
        <p className={styles.status} role="status" aria-live="polite">
          {statusText(search)}
        </p>
      </div>

      {!demo && !backendAvailable && (
        <p className={styles.notice}>The project API is waking up. Search will work in a moment.</p>
      )}

      <ul
        className={styles.list}
        aria-busy={search.status === 'loading'}
        data-xray-label={demo ? 'Sample projects in demo mode' : 'PostgreSQL full-text search, GIN index'}
      >
        {search.projects.length === 0 && (
          <li className={styles.empty}>
            {trimmed ? `No projects match “${trimmed}”. Try a technology, like react.` : 'No projects yet.'}
          </li>
        )}
        {search.projects.map((project) => (
          <li key={project.slug} className={styles.project}>
            <div className={styles.main}>
              <h3 className={styles.name}>{project.title}</h3>
              <p className={styles.summary}>{project.summary}</p>
              {(project.repoUrl || project.liveUrl) && (
                <p className={styles.links}>
                  {project.liveUrl && (
                    <a href={project.liveUrl} target="_blank" rel="noreferrer">
                      Live site
                    </a>
                  )}
                  {project.repoUrl && (
                    <a href={project.repoUrl} target="_blank" rel="noreferrer">
                      Code
                    </a>
                  )}
                </p>
              )}
            </div>
            <ul className={styles.chips} aria-label="Built with">
              {project.tech.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
            <span className={styles.year}>{project.year}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
