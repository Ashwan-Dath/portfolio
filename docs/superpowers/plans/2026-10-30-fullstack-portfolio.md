# Full-Stack Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A portfolio that proves full-stack skills by running them: a polished Next.js site with an X-ray mode that reveals the tech behind each part, and a guestbook whose every submission is shown travelling browser → Next.js → Express → PostgreSQL with real measured timings.

**Architecture:** Monorepo with `frontend/` (Next.js 16 App Router, deployed by Vercel) and `backend/` (Express 5 API in Docker on GCP Cloud Run, PostgreSQL on Neon). The browser only ever talks to Next.js; Next.js Server Components and Route Handlers call Express server-to-server with a shared internal key (backend-for-frontend). GitHub Actions runs CI for both apps and deploys the backend; Vercel deploys the frontend from GitHub on its own.

**Tech Stack:** TypeScript 5.9, Node.js 24 LTS, Next.js 16, React 19.2, CSS Modules, Express 5, node-postgres (`pg`), zod 4, pino, Vitest 3, Testing Library, supertest, Docker, GitHub Actions, GCP Cloud Run + Artifact Registry + Secret Manager, Neon PostgreSQL.

**Spec:** None separate. On 2026-10-30 the user chose to skip the design document and go straight to this plan; the Design Summary below records every decision from that conversation and is the spec.

## Design Summary

**Audience:** recruiters (often non-technical) and the engineers they forward the link to. Instead of a bio, the site shows the work running.

1. **Polished working site by default.** An X-ray toggle (a button, plus the `x` key) switches the page into a blueprint mode. Each section then shows a panel with what runs it (layers), which React hooks and Next.js features it uses, and links to the exact files on GitHub.
2. **Signature moment.** A visitor leaves a guestbook note and a Request Journey visualizer shows the request moving through five stages, with the real milliseconds spent in each, plus a "woke from zero" badge when Cloud Run cold-started.
3. **Project search** over the portfolio's projects using PostgreSQL full-text search (prefix matching, ranking), debounced, with stale requests cancelled. It shows "answered in N ms by PostgreSQL".
4. **Stack section.** Each skill links to where it is visible on the page. Java, MySQL and AWS appear only in a plain "Also worked with" line; X-ray never claims them.
5. **Content placeholders** the user fills in: `frontend/src/content/site.ts` (name, role, links, repo URL) and `backend/seed/projects.json` (projects).

**Hosting (user's decisions):** Vercel Hobby (frontend), GCP Cloud Run (Express), Neon free (PostgreSQL), GitHub Actions deploys the backend. The user deploys and tests on their own laptop.

**Non-goals:** Java service, MySQL, AWS infrastructure, CMS or admin UI, visitor accounts, analytics, nonce-based CSP, i18n, Tailwind.

**Anti-goals (failure even if it "works"):** X-ray claims a skill the code doesn't show; the guestbook becomes a spam wall a recruiter sees; the first visit after idle shows a broken or blank page; anything creates a recurring cost.

## Global Constraints

- **Nothing is installed or run in this project on this machine.** No `npm install`, builds, test runs, Docker or git until Task 13. Tests are written now; the user runs them on their laptop (the **Laptop:** lines). Optional: an executor may spot-check a dependency-free pure module (`tsquery.ts`, `journey.ts`) by copying it to the session scratchpad and running it with the system Node 26 (type stripping); nothing is written into the project.
- **No commits per task.** The whole repo is pushed to GitHub once, in Task 13.
- No lockfiles are created here. The user's first laptop step generates `package-lock.json` in both apps; CI uses `npm ci`.
- Node.js 24 LTS: `"engines": { "node": ">=24 <25" }` in both `package.json`; Docker base `node:24-alpine`; Actions `node-version: 24`.
- TypeScript everywhere with `"strict": true`, `"noUncheckedIndexedAccess": true`, `"erasableSyntaxOnly": true` (so no enums, namespaces or constructor parameter properties).
- Backend is ESM: `"type": "module"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`; relative imports end in `.js`.
- Frontend imports use the `@/` alias for `frontend/src/`.
- **Comments (user requirement: "I need to know each and every piece of code").** Every file opens with a header comment: what it is, why it exists, who uses it. Every function, hook, component, SQL statement, config key, Dockerfile instruction and workflow step gets a comment explaining what it does and why, including tradeoffs. Comments explain intent; they do not restate syntax. Each test gets one line saying what it proves.
- Styling is plain CSS: design tokens as custom properties in `globals.css` plus one CSS Module per component. No Tailwind, UI kit or animation library. Support `prefers-color-scheme` (light and dark) and `prefers-reduced-motion`.
- Dependencies (add nothing else without a comment saying why):
  - backend: `express ^5.1.0`, `pg ^8.16.0`, `zod ^4.1.0`, `helmet ^8.1.0`, `pino ^9.7.0`, `pino-http ^10.5.0`
  - backend dev: `typescript ^5.9.2`, `tsx ^4.20.0`, `vitest ^3.2.4`, `supertest ^7.1.4`, `@types/express ^5.0.3`, `@types/pg ^8.15.0`, `@types/supertest ^6.0.3`, `@types/node ^24.0.0`
  - frontend: `next ^16.0.0`, `react ^19.2.0`, `react-dom ^19.2.0`, `server-only ^0.0.1`
  - frontend dev: `typescript ^5.9.2`, `@types/node ^24.0.0`, `@types/react ^19.2.0`, `@types/react-dom ^19.2.0`, `eslint ^9.0.0`, `eslint-config-next ^16.0.0`, `vitest ^3.2.4`, `@vitejs/plugin-react ^5.0.0`, `jsdom ^26.1.0`, `@testing-library/react ^16.3.0`, `@testing-library/dom ^10.4.0`, `@testing-library/jest-dom ^6.8.0`
- LF line endings; repo-root `.gitattributes` contains `* text=auto eol=lf`.
- GCP names: Cloud Run service `portfolio-api`, region `us-central1`, Artifact Registry repo `portfolio`, secrets `portfolio-database-url` / `portfolio-internal-api-key` / `portfolio-ip-hash-salt`, runtime service account `portfolio-api-runtime`, deploy service account `portfolio-deployer`.
- Free-tier guardrails: Cloud Run `--min-instances=0 --max-instances=2 --memory=512Mi --cpu=1 --concurrency=80 --timeout=30`; Artifact Registry cleanup policy keeps the 3 newest images; GCP budget alert at $1.
- No secrets in the repo: only `.env.example` files, every variable commented.

## API Contract (both apps)

Shared types: written in `backend/src/types.ts` and mirrored verbatim in `frontend/src/lib/api-types.ts` (each file says "keep in sync with …").

```ts
export type Note = { id: string; name: string; message: string; createdAt: string }; // createdAt = ISO 8601
export type Project = { slug: string; title: string; summary: string; tech: string[]; repoUrl: string | null; liveUrl: string | null; year: number };
export type ServerTimings = { totalMs: number; dbMs: number; coldStart: boolean };
export type ErrorCode = 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'INTERNAL' | 'UPSTREAM_UNAVAILABLE';
export type ApiError = { error: { code: ErrorCode; message: string } };
```

**Express (`BACKEND_URL`).** Every `/v1/*` request needs header `X-Internal-Key: <INTERNAL_API_KEY>`; without it the API returns 401 `UNAUTHORIZED`.

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `GET /health` (no key) | – | 200 `{ status: 'ok' }` | – |
| `GET /v1/guestbook?limit=` (1–50, default 20) | – | 200 `{ notes: Note[], timings }` | 400, 401 |
| `POST /v1/guestbook` | optional header `X-Client-IP`; JSON `{ name, message, website? }` | 201 `{ note, timings }` | 400, 401, 413, 429 |
| `GET /v1/projects?q=` (q ≤ 100 chars) | – | 200 `{ projects: Project[], timings }` | 400, 401 |

An unknown route returns 404 `NOT_FOUND`. An unhandled error returns 500 `INTERNAL` with a generic message and never a stack trace. A body over 10 kB returns 413 `VALIDATION_ERROR`.

**Next.js Route Handlers (what the browser calls).** Frontend-only types in `api-types.ts`:

```ts
export type StageId = 'browser' | 'nextjs' | 'network' | 'express' | 'postgres';
export type RelayTimings = { nextTotalMs: number; upstreamMs: number; expressTotalMs: number; dbMs: number; coldStart: boolean };
export type RelayError = ApiError & { stage?: StageId };
export type CreateNoteResponse = { note: Note; timings: RelayTimings };
export type SearchProjectsResponse = { projects: Project[]; timings: RelayTimings };
export const GUESTBOOK_LIMITS = { nameMax: 40, messageMax: 280 } as const;
```

- `POST /api/guestbook` returns 201 `CreateNoteResponse`. `GET /api/projects?q=` returns 200 `SearchProjectsResponse`. Both send `Cache-Control: no-store`.
- Error mapping (shared by both handlers):
  - Backend 400, 413 or 429: passed through with the same status and body, plus `stage: 'express'`.
  - Backend 401 or any 5xx: 502 `UPSTREAM_UNAVAILABLE` with `stage: 'express'` (a 401 means our key is misconfigured; the visitor can't fix that).
  - Backend unreachable, timed out, or env vars missing: 502 `UPSTREAM_UNAVAILABLE` with `stage: 'network'`.
  - Request body is not JSON: 400 `VALIDATION_ERROR`, and the backend is never called.

## Review Focus

1. **First visit after idle.** Cloud Run is scaled to zero and Neon is asleep, or the backend is down or env vars are missing during the Vercel build. The page must still render with an "API is waking up" notice; it must never fail the build or go blank. Tests: Task 6 `getNotes returns null when env is missing / fetch rejects / status is not 2xx`; Task 8 `timeout maps to 502 with stage network`.
2. **Typing `x` in the guestbook form or the search box** must type the letter, not toggle X-ray. Test: Task 7 `shouldToggleFromKey ignores inputs, textareas, selects, contenteditable and modifier keys`.
3. **Fast typing in project search.** A slower, older response must never overwrite a newer one. Test: Task 10 `aborts the previous request and keeps only the latest results`.
4. **Abusive guestbook input** (HTML or script text, oversized bodies, repeat posts, bots). It is stored and shown as plain text, rejected over the limits, rate-limited, and honeypot posts are dropped. Tests: Task 3 limits, 413, 429, honeypot, and `stores <script> text unchanged`; Task 9 `renders a note's HTML as text`.
5. **X-ray drift.** An annotation claims a hook or file the code no longer has. Test: Task 7's registry honesty test, which covers every entry later tasks add.

## File Structure

```
.gitattributes  .gitignore  .editorconfig  README.md  DEPLOYMENT.md
.github/workflows/ci.yml                 CI for both apps
.github/workflows/deploy-backend.yml     build → push image → migrate + seed → deploy → smoke test
backend/
  package.json tsconfig.json tsconfig.build.json vitest.config.ts Dockerfile .dockerignore .env.example
  migrations/001_init.sql                schema (projects + guestbook)
  seed/projects.json                     project content (user edits)
  src/server.ts                          composition root: config → logger → pool → repos → app → listen → shutdown
  src/app.ts                             createApp(): middleware order, /health, /v1 auth, 404, errors
  src/config.ts                          loadConfig(), loadDotEnvIfPresent()
  src/logger.ts                          pino logger in Cloud Logging format
  src/types.ts                           API contract types
  src/lib/http-error.ts                  HttpError
  src/lib/timing.ts                      timed(), startTimer(), createColdStartTracker(), sendWithTimings()
  src/lib/ip-hash.ts                     hashIp()
  src/lib/tsquery.ts                     toPrefixTsQuery()
  src/middleware/require-internal-key.ts
  src/middleware/error-handler.ts        notFoundHandler, createErrorHandler()
  src/db/pool.ts  src/db/migrate.ts  src/db/seed.ts
  src/guestbook/guestbook.schema.ts  guestbook.repository.ts  guestbook.routes.ts
  src/projects/projects.repository.ts  projects.routes.ts
  test/fakes.ts + *.test.ts
frontend/
  package.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts .env.example
  test/stubs/server-only.ts             empty stub so Vitest can import server-only modules
  src/app/layout.tsx page.tsx globals.css error.tsx not-found.tsx icon.svg opengraph-image.tsx
  src/app/api/guestbook/route.ts  src/app/api/projects/route.ts
  src/content/site.ts
  src/lib/api-types.ts env.ts backend.ts relay.ts journey.ts repo-links.ts
  src/hooks/useDebouncedValue.ts usePrefersReducedMotion.ts useProjectSearch.ts
  src/xray/XrayContext.tsx XrayToggle.tsx XrayPanel.tsx registry.ts
  src/components/{Section,Hero,Guestbook,RequestJourney,ProjectSearch,StackSection,SiteFooter}/<Name>.tsx + <Name>.module.css
  frontend tests sit next to their file as *.test.ts(x)
```

---

### Task 1: Backend foundation (app shell, config, errors, auth, timing)

**Files:**
- Create: `.gitattributes`, `.gitignore` (node_modules, dist, .next, coverage, `.env*` except `.env.example`, `next-env.d.ts`), `.editorconfig`
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/vitest.config.ts`
- Create: `backend/src/types.ts`, `config.ts`, `logger.ts`, `lib/http-error.ts`, `lib/timing.ts`, `middleware/require-internal-key.ts`, `middleware/error-handler.ts`, `app.ts`
- Test: `backend/test/fakes.ts`, `backend/test/config.test.ts`, `backend/test/app.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: the contract types above.
  - `loadConfig(env: Record<string, string | undefined>): Config`, where `Config = { port: number; nodeEnv: 'development' | 'test' | 'production'; databaseUrl: string; internalApiKey: string; ipHashSalt: string; logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent' }`
  - `loadDotEnvIfPresent(): void`: calls `process.loadEnvFile('.env')` only when `NODE_ENV !== 'production'` and `.env` exists in `process.cwd()`.
  - `createLogger(level: Config['logLevel']): Logger` (pino `Logger`)
  - `class HttpError extends Error { status: number; code: ErrorCode }`, constructed as `new HttpError(status, code, message)` (explicit fields, not parameter properties)
  - `timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }>`; `startTimer(): () => number`; `createColdStartTracker(): () => boolean`; `sendWithTimings(res: Response, status: number, body: Record<string, unknown>, dbMs: number): void`. All ms values are rounded to 1 decimal.
  - `requireInternalKey(expectedKey: string): RequestHandler`
  - `notFoundHandler: RequestHandler`; `createErrorHandler(logger: Logger): ErrorRequestHandler`
  - `createApp(deps: AppDeps): Express`, where `AppDeps = { internalApiKey: string; logger: Logger; routes: Array<{ path: string; router: Router }> }`. Each `path` starts with `/` and is mounted under `/v1`. `server.ts` (Task 5) wires the real routers; tests mount their own.
  - `test/fakes.ts`: `TEST_KEY = 'k'.repeat(32)`, `TEST_SALT = 's'.repeat(16)`, `silentLogger` (`createLogger('silent')`). Tasks 3 and 4 add fake repositories here.

- [ ] **Step 1: Write root files and backend tooling.**
  - `package.json` scripts:
    - `dev`: `tsx watch src/server.ts`
    - `build`: `tsc -p tsconfig.build.json`
    - `start`: `node dist/server.js`
    - `typecheck`: `tsc --noEmit`
    - `test`: `vitest run`
    - `migrate`: `tsx src/db/migrate.ts`
    - `seed`: `tsx src/db/seed.ts`
  - `tsconfig.build.json` extends the base config with `rootDir: src`, `outDir: dist`, and excludes `test`.
  - `vitest.config.ts` uses `environment: 'node'`.

- [ ] **Step 2: Write the failing tests.**

```ts
// test/config.test.ts
const valid = { DATABASE_URL: 'postgresql://u:p@host/db?sslmode=verify-full', INTERNAL_API_KEY: TEST_KEY, IP_HASH_SALT: TEST_SALT };
it('applies defaults', () => expect(loadConfig(valid)).toMatchObject({ port: 8080, nodeEnv: 'development', logLevel: 'info' }));
it('reads PORT as a number', () => expect(loadConfig({ ...valid, PORT: '3000' }).port).toBe(3000));
it('names every bad variable but never echoes values', () => {
  const run = () => loadConfig({ INTERNAL_API_KEY: 'short-secret' });
  expect(run).toThrow(/DATABASE_URL/); expect(run).toThrow(/INTERNAL_API_KEY/); expect(run).toThrow(/IP_HASH_SALT/);
  expect(run).not.toThrow(/short-secret/);
});
it('rejects a non-postgres DATABASE_URL', () => expect(() => loadConfig({ ...valid, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/));

// test/app.test.ts — a test router mounted at path '/test': GET /boom throws Error('secret detail'); POST /echo returns req.body
it('GET /health is public', ...);                  // 200 { status: 'ok' }, no key header
it('rejects /v1 without the key', ...);           // 401 { error: { code: 'UNAUTHORIZED' } }
it('rejects /v1 with a wrong key', ...);          // X-Internal-Key: 'x'.repeat(32) → 401
it('returns JSON 404 for unknown routes', ...);   // GET /v1/nope with key → 404 code NOT_FOUND
it('hides internals on 500', ...);                // GET /v1/test/boom → 500 code INTERNAL; body text has no 'secret detail' and no 'at '
it('rejects bodies over 10kb', ...);              // POST /v1/test/echo with an 11 000-char string → 413 code VALIDATION_ERROR
it('rejects malformed JSON', ...);                // POST '{bad' as application/json → 400 code VALIDATION_ERROR
it('sets helmet headers', ...);                   // x-content-type-options: nosniff; no x-powered-by header
```

- [ ] **Step 3: Implement the files in the Interfaces block.**
  - `loadConfig` uses a zod schema with these rules:
    - `PORT`: integer 1–65535, default 8080.
    - `NODE_ENV`: default `development`.
    - `DATABASE_URL`: must start with `postgres://` or `postgresql://`.
    - `INTERNAL_API_KEY`: at least 32 characters.
    - `IP_HASH_SALT`: at least 16 characters.
    - `LOG_LEVEL`: default `info`.
    - On failure it throws `Error('Invalid environment: <comma-separated names>')`.
  - `createLogger`:
    - Settings: `messageKey: 'message'` and `formatters.level: (label) => ({ severity: label.toUpperCase() })`, so Cloud Logging reads the levels.
    - Redact `req.headers["x-internal-key"]`, `req.headers.cookie` and `req.headers.authorization`.
  - `requireInternalKey`: compare SHA-256 digests of both keys with `crypto.timingSafeEqual` (equal-length buffers, so the key's length doesn't leak).
  - `createErrorHandler` maps errors to responses:
    - `HttpError`: its own status and code.
    - `ZodError`: 400 `VALIDATION_ERROR` with message `"<path>: <issue message>"` taken from the first issue.
    - `err.type === 'entity.too.large'`: 413.
    - `err.type === 'entity.parse.failed'`: 400.
    - Anything else: log it at error level and return 500 `INTERNAL` with message `"Something went wrong."`.
  - `createApp` middleware order:
    1. `helmet()`
    2. `pino-http({ logger })`
    3. A request timer that sets `res.locals.elapsedMs = startTimer()`.
    4. A cold-start marker that sets `res.locals.coldStart = tracker()`. The tracker is created inside `createApp`, so the flag is per container.
    5. `express.json({ limit: '10kb' })`
    6. `GET /health`
    7. `/v1` with `requireInternalKey`, then the given routes.
    8. `notFoundHandler`
    9. The error handler.
  - `sendWithTimings`:
    - Builds `ServerTimings` from `res.locals` and the given `dbMs`.
    - Sets the header `Server-Timing: db;dur=<dbMs>, total;dur=<totalMs>`.
    - Responds with `{ ...body, timings }`.

- [ ] **Step 4: Static check.** Every import resolves to an export listed above, nothing uses `any`, and every file has its header comment.
- [ ] **Laptop:** `cd backend && npm test`. Expected: config and app tests pass.

---

### Task 2: Database schema, migrations, seed

**Files:**
- Create: `backend/migrations/001_init.sql`, `backend/src/db/pool.ts`, `backend/src/db/migrate.ts`, `backend/src/db/seed.ts`, `backend/seed/projects.json`
- Test: `backend/test/migrate.test.ts`, `backend/test/seed.test.ts`

**Interfaces:**
- Consumes: `createLogger`, `loadDotEnvIfPresent` (Task 1).
- Produces:
  - `createPool(databaseUrl: string, logger: Logger): Pool`
  - `listPendingMigrations(files: string[], applied: ReadonlySet<string>): string[]`
  - `runMigrations(pool: Pool, dir: string, log: (msg: string) => void): Promise<string[]>`
  - `parseSeedProjects(json: unknown): SeedProject[]`, where `SeedProject = Project & { sortOrder: number }`. On invalid input it throws `Error('Invalid seed file: projects[<index>].<field>: <message>')` for the first issue.
  - Table and column names used by Tasks 3 and 4: `projects(slug, title, summary, tech, repo_url, live_url, year, sort_order, search_vector)` and `guestbook_notes(id, name, message, ip_hash, is_hidden, created_at)`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('returns unapplied NNN_name.sql files in order, ignoring other files', () =>
  expect(listPendingMigrations(['002_b.sql', '001_a.sql', 'README.md', '003_c.sql', 'x.sql'], new Set(['001_a.sql'])))
    .toEqual(['002_b.sql', '003_c.sql']));
it('accepts a valid seed file', ...);                    // 2 valid projects → length 2, sortOrder kept
it('names the bad field in a broken seed file', () =>    // projects[1] lacks title
  expect(() => parseSeedProjects([validProject, { ...validProject, title: undefined }])).toThrow(/projects\[1\]\.title/));
it('rejects a slug with spaces or capitals', ...);       // slug 'My Project' → throws /slug/
```

- [ ] **Step 2: Write `001_init.sql` exactly as specified below (comment every statement).**

```sql
-- array_to_string is STABLE, but generated columns require IMMUTABLE functions,
-- so this wrapper pins the behaviour for our text[] column.
CREATE FUNCTION immutable_array_to_string(arr text[], sep text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN array_to_string(arr, sep);

CREATE TABLE projects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL, summary text NOT NULL,
  tech text[] NOT NULL DEFAULT '{}',
  repo_url text, live_url text,
  year smallint NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  sort_order integer NOT NULL DEFAULT 0,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', immutable_array_to_string(tech, ' ')), 'A') ||
    setweight(to_tsvector('english', summary), 'B')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_search_idx ON projects USING GIN (search_vector);

CREATE TABLE guestbook_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(40) NOT NULL CHECK (length(btrim(name)) > 0),
  message varchar(280) NOT NULL CHECK (length(btrim(message)) > 0),
  ip_hash char(64) NOT NULL,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guestbook_notes_visible_recent_idx ON guestbook_notes (created_at DESC) WHERE NOT is_hidden;
CREATE INDEX guestbook_notes_ip_recent_idx ON guestbook_notes (ip_hash, created_at DESC);
```

- [ ] **Step 3: Implement `pool.ts`, `migrate.ts` and `seed.ts`.**
  - `createPool`: `max: 5`, `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 10_000` (Neon can take about a second to wake). Add `pool.on('error', …)` logging, so an idle-client error can't crash the process. Do not connect at startup; connecting lazily keeps cold starts fast.
  - `runMigrations`:
    - Creates `schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())` if it doesn't exist.
    - Runs each pending file in its own `BEGIN` … `INSERT INTO schema_migrations` … `COMMIT`, rolling back and rethrowing on failure.
    - Uses no advisory lock: the deploy workflow's concurrency group prevents parallel runs, and Neon's pooled connection doesn't keep session locks.
  - `migrate.ts` CLI:
    - Runs `loadDotEnvIfPresent()`, then reads only `process.env.DATABASE_URL`; if it is missing, it exits 1 with a clear message.
    - Migrations dir is `path.resolve(process.cwd(), 'migrations')`.
    - The CLI runs only when the file is executed directly (`import.meta.url` matches `process.argv[1]`), so tests can import the pure function.
  - `seed.ts` CLI:
    - Validates `seed/projects.json` with `parseSeedProjects`.
    - In one transaction, upserts each project with `INSERT … ON CONFLICT (slug) DO UPDATE SET … , updated_at = now()`.
    - Then runs `DELETE FROM projects WHERE slug <> ALL($1::text[])`, so the file is the single source of truth.
  - `projects.json`: four entries.
    - The first is real: slug `this-portfolio`, describing this site and its stack.
    - The other three are clearly marked placeholders, e.g. summary starting `"Placeholder — replace with a real project:"`.

- [ ] **Step 4: Static check.** Column names in the SQL match the Interfaces block; the seed's zod schema matches the `Project` fields.
- [ ] **Laptop:** `npm test`, then, after Neon setup (DEPLOYMENT.md), run `npm run migrate && npm run seed`. Expected: `001_init.sql` applied once; running it again applies nothing; `SELECT count(*) FROM projects` = 4.

---

### Task 3: Guestbook API

**Files:**
- Create: `backend/src/lib/ip-hash.ts`, `backend/src/guestbook/guestbook.schema.ts`, `guestbook.repository.ts`, `guestbook.routes.ts`
- Modify: `backend/test/fakes.ts` (add the fake repository)
- Test: `backend/test/guestbook.test.ts`

**Interfaces:**
- Consumes: `createApp`, `HttpError`, `timed`, `sendWithTimings`, `TEST_KEY`, `TEST_SALT`, `silentLogger` (Task 1); table `guestbook_notes` (Task 2).
- Produces:
  - `hashIp(ip: string, salt: string): string`: SHA-256 hex of `` `${salt}:${ip}` ``.
  - `GUESTBOOK_LIMITS = { nameMax: 40, messageMax: 280 } as const`; `cleanText(input: string): string`; `createNoteSchema`; `listNotesQuerySchema`.
  - `NewNote = { name: string; message: string; ipHash: string }`.
  - `interface GuestbookRepository { listRecent(limit: number): Promise<Note[]>; countRecentByIpHash(ipHash: string, windowMinutes: number): Promise<number>; create(note: NewNote): Promise<Note> }`.
  - `createPgGuestbookRepository(pool: Pool): GuestbookRepository`.
  - `RATE_LIMIT = { maxNotes: 3, windowMinutes: 10 } as const`; `createGuestbookRouter(deps: { repo: GuestbookRepository; ipHashSalt: string }): Router`.
  - `createFakeGuestbookRepository(seed?: Note[]): GuestbookRepository & { created: NewNote[] }`, added to `fakes.ts`.

- [ ] **Step 1: Write the failing tests** (app built with `createApp` and the router mounted at `/guestbook`; every request sends `X-Internal-Key: TEST_KEY`).

```ts
it('cleanText strips control chars, normalises newlines, trims', () => {
  expect(cleanText(' Ada \u0007')).toBe('Ada');
  expect(cleanText('a\r\n\r\n\r\n\r\nb')).toBe('a\n\nb');
  expect(cleanText('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
});
it('hashIp is stable, 64 hex chars, salt-dependent', ...);
it('GET lists recent notes with timings', ...);           // 200; notes from the fake; timings has numeric totalMs and dbMs, boolean coldStart
it('GET rejects limit=0 and limit=51', ...);              // 400 VALIDATION_ERROR
it('POST creates a note', ...);                           // {name:' Ada ', message:'Hi!'} → 201; note.name === 'Ada'; header Server-Timing contains 'db;dur='
it('POST stores <script> text unchanged', ...);           // message '<b>hi</b><script>x</script>' → returned and stored as-is
it('POST rejects an empty name and a 281-char message', ...);  // 400 VALIDATION_ERROR each; message mentions name / message
it('POST rate-limits the 4th note in 10 minutes per IP', ...); // 3× 201 with X-Client-IP '203.0.113.7', then 429 RATE_LIMITED; another IP still gets 201
it('POST drops honeypot submissions silently', ...);      // website:'spam.example' → 201, fake.created is empty
it('POST without X-Client-IP still works', ...);          // 201; hashed as 'unknown'
it('reports coldStart true only on the first request', ...); // first response true, second false
```

- [ ] **Step 2: Implement.**
  - `cleanText`: remove `[\u0000-\u0008\u000B-\u001F\u007F]`, turn `\r\n` into `\n`, collapse 3 or more newlines to 2, then trim.
  - Schema fields: each runs `z.string()` → `cleanText` → length check. `name` is 1–40 (`"Name is required"` / `"Name is too long"`). `message` is 1–280 (same wording). `website` is an optional string of at most 200.
  - Query: `limit` uses `z.coerce.number().int().min(1).max(50).default(20)`.
  - Repository SQL (comment each):
    - `listRecent`: `SELECT id::text, name, message, created_at FROM guestbook_notes WHERE NOT is_hidden ORDER BY created_at DESC LIMIT $1`. Map `created_at` to an ISO string.
    - `countRecentByIpHash`: `SELECT count(*)::int AS count FROM guestbook_notes WHERE ip_hash = $1 AND created_at > now() - make_interval(mins => $2)`.
    - `create`: `INSERT INTO guestbook_notes (name, message, ip_hash) VALUES ($1, $2, $3) RETURNING id::text, name, message, created_at`.
  - `POST` flow:
    1. Parse the body.
    2. If `website` is non-empty, respond 201 with `{ note: { id: '0', name, message, createdAt: now } }` and `dbMs` 0, without calling the repository.
    3. Take the IP from `req.get('x-client-ip')?.trim() || 'unknown'` and hash it.
    4. Inside a single `timed()`, count recent notes. If the count is at least `RATE_LIMIT.maxNotes`, throw `HttpError(429, 'RATE_LIMITED', 'You can leave 3 notes every 10 minutes. Please try again later.')`; otherwise create the note.
    5. Respond with `sendWithTimings(res, 201, { note }, ms)`.
  - Fake repository: in-memory array, newest first. `countRecentByIpHash` counts entries created within the window.

- [ ] **Step 3: Static check.** The interface method names match the fake and the pg implementation.
- [ ] **Laptop:** `npm test -- test/guestbook.test.ts`. Expected: all pass.

---

### Task 4: Projects search API

**Files:**
- Create: `backend/src/lib/tsquery.ts`, `backend/src/projects/projects.repository.ts`, `projects.routes.ts`
- Modify: `backend/test/fakes.ts`
- Test: `backend/test/tsquery.test.ts`, `backend/test/projects.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; table `projects` (Task 2).
- Produces:
  - `toPrefixTsQuery(input: string): string | null`
  - `interface ProjectsRepository { listAll(): Promise<Project[]>; search(tsQuery: string, limit: number): Promise<Project[]> }`
  - `createPgProjectsRepository(pool: Pool): ProjectsRepository`
  - `SEARCH_LIMIT = 20`; `createProjectsRouter(deps: { repo: ProjectsRepository }): Router`
  - `createFakeProjectsRepository(projects: Project[]): ProjectsRepository & { searchCalls: Array<{ tsQuery: string; limit: number }> }`

- [ ] **Step 1: Write the failing tests.**

```ts
it.each([
  ['  React  hooks!! ', 'react:* & hooks:*'],
  ['Next.js', 'next:* & js:*'],
  ["'; DROP TABLE", 'drop:* & table:*'],
  ['café', 'café:*'],
  ['', null], ['!!! ---', null],
])('toPrefixTsQuery(%j) → %j', (input, out) => expect(toPrefixTsQuery(input)).toBe(out));
it('keeps at most 8 tokens of at most 32 chars', ...);   // 10 words → 8 parts; a 40-char word → 32 chars + ':*'
it('GET without q lists all projects', ...);             // 200, listAll used, searchCalls empty, timings present
it('GET with q searches with a prefix tsquery', ...);    // q='react hooks' → searchCalls[0] = { tsQuery: 'react:* & hooks:*', limit: 20 }
it('GET with only symbols falls back to all', ...);      // q='%%%' → listAll used
it('GET rejects q over 100 chars', ...);                 // 400 VALIDATION_ERROR
```

- [ ] **Step 2: Implement.**
  - `toPrefixTsQuery`:
    - Lowercase the input and take tokens matching `/[\p{L}\p{N}]+/gu`.
    - Keep the first 8, slice each to 32 characters, and map each token to `` `${t}:*` ``.
    - Join with `' & '`; return `null` when there are no tokens.
    - The output only ever contains letters, digits, `:*` and ` & `, so it is safe to pass to `to_tsquery`. Comment why: `to_tsquery` is used instead of `websearch_to_tsquery` so that "reac" matches "React".
  - SQL:
    - `listAll`: `SELECT slug, title, summary, tech, repo_url, live_url, year FROM projects ORDER BY sort_order, year DESC`.
    - `search`: `SELECT slug, title, summary, tech, repo_url, live_url, year FROM projects, to_tsquery('english', $1) AS query WHERE search_vector @@ query ORDER BY ts_rank(search_vector, query) DESC, sort_order LIMIT $2`.
    - Map snake_case columns to camelCase.
  - Route: `q` is `z.string().max(100).optional()` → `toPrefixTsQuery` → `search` or `listAll`, wrapped in `timed`, then `sendWithTimings(res, 200, { projects }, ms)`.

- [ ] **Step 3: Optional spot-check.** Copy `tsquery.ts` to the scratchpad and run the `it.each` table through system Node 26.
- [ ] **Laptop:** `npm test`. Expected: all backend tests pass.

---

### Task 5: Runnable backend service and container

**Files:**
- Create: `backend/src/server.ts`, `backend/Dockerfile`, `backend/.dockerignore`, `backend/.env.example`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: a container that listens on `$PORT` (default 8080) and runs `node dist/server.js`.

- [ ] **Step 1: Implement `server.ts`.**
  - Startup order: `loadDotEnvIfPresent()` → `loadConfig(process.env)` → `createLogger` → `createPool` → both pg repositories → `createApp` with routes `/guestbook` and `/projects` → `listen(config.port)`.
  - On `SIGTERM` or `SIGINT`: log, call `server.close()`, then `pool.end()`, then exit 0.
  - A forced exit after 9 s, with an `unref()`'d timer, because Cloud Run allows 10 s.
  - Log uncaught startup errors and exit 1.
- [ ] **Step 2: Write the Dockerfile (multi-stage, comment every line).**
  - `deps` stage: copy `package.json` and `package-lock.json`, run `npm ci`.
  - `build` stage: copy `tsconfig*.json` and `src`, run `npm run build`.
  - `runtime` stage:
    - Base `node:24-alpine` with `ENV NODE_ENV=production`.
    - `npm ci --omit=dev && npm cache clean --force`; copy `dist` from `build`.
    - `USER node`, `EXPOSE 8080`, `CMD ["node", "dist/server.js"]`.
  - Migrations are not in the image; CI runs them.
- [ ] **Step 3: Write `.dockerignore` and `.env.example`.**
  - `.dockerignore`: node_modules, dist, test, coverage, `.env*`, `*.md`.
  - `.env.example`: `PORT`, `NODE_ENV`, `DATABASE_URL` (Neon pooled URL with `sslmode=verify-full`), `INTERNAL_API_KEY` (≥ 32 chars, with the command to generate one), `IP_HASH_SALT`, `LOG_LEVEL`.
- [ ] **Laptop:** `npm run build && npm start` with `.env` filled. Then `curl localhost:8080/health` returns `{"status":"ok"}`, and `curl -H "X-Internal-Key: $KEY" localhost:8080/v1/projects` returns 4 projects. `docker build -t portfolio-api .` succeeds.

---

### Task 6: Frontend foundation (tooling, layout, content, server data access)

**Files:**
- Create: `frontend/package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.env.example`, `test/stubs/server-only.ts`
- Create: `frontend/src/app/layout.tsx`, `page.tsx` (temporary placeholder, replaced in Task 11), `globals.css`, `error.tsx`, `not-found.tsx`, `icon.svg`
- Create: `frontend/src/content/site.ts`, `src/lib/api-types.ts`, `src/lib/env.ts`, `src/lib/backend.ts`, `src/lib/repo-links.ts`
- Test: `src/lib/backend.test.ts`, `src/lib/repo-links.test.ts`

**Interfaces:**
- Produces:
  - `api-types.ts`: everything in the API Contract section.
  - `site`, an `as const` object: `{ name, role, tagline, email, githubUrl, linkedinUrl, repoUrl, siteUrl, alsoWorkedWith: ['Java', 'MySQL', 'AWS'] }`. Placeholder values each carry a `// TODO(you):` comment.
  - `getServerEnv(): { backendUrl: string; internalApiKey: string }` (throws `Error('Missing env: <NAME>')`; strips the trailing `/` from the URL; file starts with `import 'server-only'`).
  - `BACKEND_TIMEOUT_MS = 10_000`.
  - `backendFetch(path: string, init?: RequestInit & { next?: { revalidate?: number | false } }): Promise<Response>`: adds the base URL and the `X-Internal-Key` header, and `signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS)` unless `init.signal` is given.
  - `getNotes(): Promise<Note[] | null>`: `GET /v1/guestbook?limit=20` with `next: { revalidate: 60 }`.
  - `getProjects(): Promise<Project[] | null>`: `GET /v1/projects` with `next: { revalidate: 300 }`.
  - `githubFileUrl(repoPath: string): string`.
- Contract for both getters: `null` means the backend is unavailable. They never throw, and they `console.error` the cause.

- [ ] **Step 1: Write the tooling files.**
  - `package.json` scripts:
    - `dev`: `next dev`
    - `build`: `next build`
    - `start`: `next start`
    - `lint`: `eslint .`
    - `typecheck`: `next typegen && tsc --noEmit`
    - `test`: `vitest run`
  - `tsconfig.json`: the standard Next.js 16 settings plus the strict flags from Global Constraints, and `paths: { "@/*": ["./src/*"] }`.
  - `eslint.config.mjs`: `defineConfig([...nextVitals, ...nextTs, globalIgnores(['.next/**', 'next-env.d.ts'])])`, importing from `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
  - `vitest.config.ts`:
    - Uses `@vitejs/plugin-react` with `environment: 'jsdom'` and `setupFiles: ['./vitest.setup.ts']`.
    - Aliases: `'@'` → `./src` and `'server-only'` → `./test/stubs/server-only.ts`. Without the stub, the real package throws outside React Server Components.
  - `vitest.setup.ts`: `import '@testing-library/jest-dom/vitest'`.
  - `next.config.ts`: `reactStrictMode: true`, `poweredByHeader: false`, and `headers()` applying `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and `Permissions-Policy: camera=(), microphone=(), geolocation=()` to `/:path*`.
  - `.env.example`: `BACKEND_URL`, `INTERNAL_API_KEY` (must equal the backend's).

- [ ] **Step 2: Write the failing tests.**

```ts
// backend.test.ts — vi.stubGlobal('fetch', …); set/unset process.env.BACKEND_URL and INTERNAL_API_KEY per test
it('getNotes returns notes on 200 and sends the key', ...);    // fetch URL `${BACKEND_URL}/v1/guestbook?limit=20`; header X-Internal-Key; init.next.revalidate === 60
it('getNotes returns null when env is missing', ...);          // fetch not called
it('getNotes returns null when fetch rejects', ...);           // e.g. a TimeoutError DOMException
it('getNotes returns null when status is not 2xx', ...);       // 503
it('getProjects uses revalidate 300', ...);
// repo-links.test.ts
it('builds a blob/main URL', () =>
  expect(githubFileUrl('frontend/src/app/page.tsx')).toBe(`${site.repoUrl}/blob/main/frontend/src/app/page.tsx`));
it('strips leading slashes', () => expect(githubFileUrl('/backend/src/app.ts')).toBe(`${site.repoUrl}/blob/main/backend/src/app.ts`));
```

- [ ] **Step 3: Implement the lib files, then the app shell.**
  - `layout.tsx`:
    - Fonts via `next/font/google`: `Space_Grotesk` (text) and `JetBrains_Mono` (code), exposed as `--font-sans` and `--font-mono`.
    - `metadata`: title `` `${site.name} — ${site.role}` ``, description from `site.tagline`, `metadataBase: new URL(site.siteUrl)`, and `openGraph`.
    - `<html lang="en">` and a skip link to `#main`.
  - `globals.css`:
    - Tokens for colour (light and dark via `prefers-color-scheme`), a spacing scale, radii, and a `--xray-*` set used in Task 7.
    - A modern reset, focus-visible styles, and a `prefers-reduced-motion` block that zeroes animation durations.
  - Visual polish is the implementer's call within these tokens. Aim for calm, technical and high-contrast; it should not look like a stock template.
  - `error.tsx`: client boundary with a "Try again" button calling `reset()`. `not-found.tsx`: link home.

- [ ] **Laptop:** `cd frontend && npm install && npm test && npm run lint && npm run typecheck`. Expected: all pass.

---

### Task 7: X-ray mode (context, toggle, panel, registry, Section)

**Files:**
- Create: `frontend/src/xray/XrayContext.tsx`, `XrayToggle.tsx`, `XrayPanel.tsx`, `registry.ts`, `frontend/src/components/Section/Section.tsx` + `Section.module.css`, and a `XrayPanel.module.css` and `XrayToggle.module.css`
- Modify: `frontend/src/app/layout.tsx` (wrap in `XrayProvider`; sticky header with `site.name` and `XrayToggle`), `globals.css` (`[data-xray='on']` blueprint styles)
- Test: `src/xray/XrayContext.test.tsx`, `src/xray/registry.test.ts`

**Interfaces:**
- Consumes: `githubFileUrl` (Task 6).
- Produces:
  - `XrayProvider({ children }: { children: ReactNode })`; `useXray(): { enabled: boolean; toggle(): void; setEnabled(v: boolean): void }`, which throws outside the provider.
  - `shouldToggleFromKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: EventTarget | null }): boolean`.
  - `XRAY_STORAGE_KEY = 'xray-enabled'`.
  - `SectionId = 'hero' | 'guestbook' | 'projects' | 'stack'`.
  - `XrayLayer = 'HTML' | 'CSS' | 'TypeScript' | 'React' | 'Next.js' | 'Node.js' | 'Express' | 'PostgreSQL' | 'GCP Cloud Run' | 'Vercel' | 'GitHub Actions'`. Java, MySQL and AWS are deliberately absent.
  - `XrayEntry = { id: SectionId; title: string; summary: string; layers: XrayLayer[]; hooks: string[]; nextFeatures: string[]; files: Array<{ label: string; path: string }> }`, where `path` is relative to the repo root.
  - `xrayRegistry: XrayEntry[]`; `getXrayEntry(id: SectionId): XrayEntry | undefined`. Later tasks append entries.
  - `Section({ id, heading, children }: { id: SectionId; heading: string; children: ReactNode })` (server component).
  - `XrayToggle()`; `XrayPanel({ entry }: { entry: XrayEntry | undefined })`, which renders `null` when X-ray is off or the entry is missing.

- [ ] **Step 1: Write the failing tests.**

```ts
// XrayContext.test.tsx
it.each(['x', 'X'])('toggles on %s pressed on the page', k => expect(shouldToggleFromKey({ key: k, ctrlKey: false, metaKey: false, altKey: false, target: document.body })).toBe(true));
it('ignores inputs, textareas, selects, contenteditable and modifier keys', ...); // each → false; also key 'y' → false
it('toggle sets data-xray on <html> and persists it', ...);   // click toggle → documentElement.dataset.xray === 'on'; localStorage 'xray-enabled' === '1'
it('restores the saved preference after mount', ...);          // localStorage '1' before render → 'on' after effects
it('survives localStorage throwing', ...);                     // Storage.prototype.getItem/setItem throw → no crash, toggle still works
// registry.test.ts  (// @vitest-environment node)
it('every entry lists at least one file and every file exists', ...);     // fs.existsSync(path.join(repoRoot, file.path)); repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
it('every hook an entry claims appears as a call in its files', ...);     // new RegExp(`\\b${hook}\\s*[<(]`) matches the concatenated source
it('ids are unique', ...);
```

- [ ] **Step 2: Implement.**
  - `XrayProvider`:
    - Starts with `useState(false)`, so server and client render the same HTML.
    - A `useEffect` reads localStorage (wrapped in try/catch) after mount.
    - A second `useEffect` mirrors the state to `document.documentElement.dataset.xray` and to storage.
    - A third registers the `keydown` listener using `shouldToggleFromKey`.
    - `toggle` uses `useCallback`, and the context value uses `useMemo`.
  - `XrayToggle`: `<button aria-pressed aria-keyshortcuts="x">` showing "X-ray" plus a `<kbd>X</kbd>` hint.
  - `XrayPanel`: shows title, summary, layer chips, a "React hooks" list in mono font, a "Next.js features" list, and file links (`githubFileUrl`, `target="_blank" rel="noreferrer"`).
  - `Section`: `<section id aria-labelledby>` containing an `<h2>`, `children` and `<XrayPanel entry={getXrayEntry(id)} />`.
  - Registry entry `hero` (the page shell and X-ray itself):
    - layers `['HTML', 'CSS', 'TypeScript', 'React', 'Next.js', 'Vercel']`
    - hooks `['useState', 'useEffect', 'useCallback', 'useMemo', 'useContext']`
    - nextFeatures `['App Router', 'Server Components', 'next/font', 'Metadata API']`
    - files `frontend/src/app/layout.tsx`, `frontend/src/xray/XrayContext.tsx`
  - CSS: `[data-xray='on'] section` gets a dashed outline and a blueprint grid background via the `--xray-*` tokens; the panel slides in (no motion under reduced motion).

- [ ] **Laptop:** `npm test -- src/xray`. Expected: all pass.

---

### Task 8: Next.js Route Handlers (relay to Express)

**Files:**
- Create: `frontend/src/lib/relay.ts`, `frontend/src/app/api/guestbook/route.ts`, `frontend/src/app/api/projects/route.ts`
- Test: `src/app/api/guestbook/route.test.ts`, `src/app/api/projects/route.test.ts`

**Interfaces:**
- Consumes: `backendFetch` (Task 6); contract types.
- Produces:
  - `relayToBackend(path: string, init: RequestInit, startedAt: number): Promise<Response>`, which implements the error mapping and timing merge in the API Contract.
  - `POST(request: NextRequest): Promise<Response>` in the guestbook route; `GET(request: NextRequest): Promise<Response>` in the projects route.

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment node` so Node's own `Request` is used; `vi.stubGlobal('fetch', …)`; env set in `beforeEach`; call the exported handler with `new NextRequest(url, init)`). `src/lib/backend.test.ts` (Task 6) uses the node environment too.

```ts
it('forwards body, key and first x-forwarded-for IP', ...);  // x-forwarded-for '203.0.113.7, 10.0.0.1' → upstream X-Client-IP '203.0.113.7', X-Internal-Key set, URL `${BACKEND_URL}/v1/guestbook`, method POST
it('merges timings on success', ...);                        // backend 201 { note, timings:{totalMs:12, dbMs:5, coldStart:true} } → 201; timings.expressTotalMs 12, dbMs 5, coldStart true, nextTotalMs >= upstreamMs >= 0; Cache-Control no-store
it('passes 429 through with stage express', ...);            // status 429, error.code RATE_LIMITED, stage 'express'
it('maps backend 500 and 401 to 502 stage express', ...);
it('maps a timeout to 502 stage network', ...);              // fetch rejects with new DOMException('t', 'TimeoutError')
it('maps missing env to 502 stage network', ...);
it('rejects a non-JSON body without calling the backend', ...); // 400 VALIDATION_ERROR; fetch not called
// projects
it('forwards q encoded', ...);                               // ?q=react hooks → upstream `/v1/projects?q=react%20hooks`
it('returns projects with merged timings', ...);
```

- [ ] **Step 2: Implement.**
  - `relayToBackend`:
    1. Times only the `backendFetch` call (`upstreamMs`); `startedAt` comes from the handler's first line (`performance.now()`).
    2. On 2xx it splits the backend JSON into `{ timings, ...rest }`.
    3. It returns `NextResponse.json({ ...rest, timings: RelayTimings }, { status, headers: { 'Cache-Control': 'no-store' } })`, with `nextTotalMs` measured just before responding.
    4. Errors are mapped per the API Contract table. A 401 also logs `"INTERNAL_API_KEY mismatch"`.
  - The guestbook `POST` forwards only `{ name, message, website }` from the parsed body. `X-Client-IP` is the first comma-separated entry of `x-forwarded-for`, falling back to `x-real-ip`; omit the header when both are absent.

- [ ] **Laptop:** `npm test -- src/app/api`. Expected: all pass.

---

### Task 9: Guestbook and Request Journey (signature moment)

**Files:**
- Create: `frontend/src/lib/journey.ts`, `frontend/src/hooks/usePrefersReducedMotion.ts`, `frontend/src/components/RequestJourney/RequestJourney.tsx` + `.module.css`, `frontend/src/components/Guestbook/Guestbook.tsx` + `.module.css`
- Modify: `frontend/src/xray/registry.ts` (add the `guestbook` entry)
- Test: `src/lib/journey.test.ts`, `src/components/Guestbook/Guestbook.test.tsx`

**Interfaces:**
- Consumes: contract types, `GUESTBOOK_LIMITS` (Task 6); `Section`, registry (Task 7); `POST /api/guestbook` (Task 8).
- Produces:
  - `STAGES: ReadonlyArray<{ id: StageId; label: string; host: string }>`, with these exact entries in this order:
    1. `browser` / "Browser · React" / "Your device"
    2. `nextjs` / "Next.js route handler" / "Vercel"
    3. `network` / "Vercel → Cloud Run" / "Internet"
    4. `express` / "Express API" / "GCP Cloud Run"
    5. `postgres` / "PostgreSQL" / "Neon"
  - `RawJourneyTimings = RelayTimings & { clientTotalMs: number }`; `StageTiming = { id: StageId; ms: number }`.
  - `buildJourneyBreakdown(raw: RawJourneyTimings): StageTiming[]`.
  - `JourneyState = { status: 'idle' } | { status: 'sending' } | { status: 'done'; stages: StageTiming[]; totalMs: number; coldStart: boolean } | { status: 'failed'; failedAt: StageId; message: string }`.
  - `JourneyAction = { type: 'send' } | { type: 'succeed'; raw: RawJourneyTimings } | { type: 'fail'; failedAt: StageId; message: string } | { type: 'reset' }`.
  - `journeyReducer(state, action): JourneyState`; `initialJourneyState: JourneyState = { status: 'idle' }`.
  - `usePrefersReducedMotion(): boolean`.
  - `RequestJourney({ state }: { state: JourneyState })`.
  - `Guestbook({ initialNotes, backendAvailable }: { initialNotes: Note[]; backendAvailable: boolean })`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('splits the round trip into stages', () =>
  expect(buildJourneyBreakdown({ clientTotalMs: 420, nextTotalMs: 300, upstreamMs: 260, expressTotalMs: 90, dbMs: 40, coldStart: false }))
    .toEqual([{ id: 'browser', ms: 120 }, { id: 'nextjs', ms: 40 }, { id: 'network', ms: 170 }, { id: 'express', ms: 50 }, { id: 'postgres', ms: 40 }]));
it('clamps negatives to 0 and rounds', () =>
  expect(buildJourneyBreakdown({ clientTotalMs: 100, nextTotalMs: 120, upstreamMs: 130.4, expressTotalMs: 20, dbMs: 30.6, coldStart: false }).map(s => s.ms))
    .toEqual([0, 0, 110, 0, 31]));
it('send → sending; succeed → done with stages and totalMs', ...);   // totalMs === Math.round(clientTotalMs)
it('ignores succeed/fail unless sending', ...);                      // from idle → same object returned
it('reset → idle', ...);
// Guestbook.test.tsx — fetch stubbed; submit via fireEvent.submit inside act
it('shows the note optimistically, then the journey summary', ...);  // note text visible before fetch resolves; afterwards /5 layers in \d+ ms/ in the status region
it('shows the API message and marks the express stage on 429', ...);
it('marks the browser stage when fetch rejects', ...);
it("renders a note's HTML as text", ...);                            // initialNotes message '<b>x</b>' → text '<b>x</b>' present; no <b> element
it('shows a waking-up notice when backendAvailable is false', ...);
```

- [ ] **Step 2: Implement `journey.ts`.**
  - Breakdown formulas:
    - browser = `clientTotalMs − nextTotalMs`
    - nextjs = `nextTotalMs − upstreamMs`
    - network = `upstreamMs − expressTotalMs`
    - express = `expressTotalMs − dbMs`
    - postgres = `dbMs`
    - Each is `Math.max(0, Math.round(x))`.
  - Reducer: `send` always goes to `sending`; `succeed` and `fail` apply only while `sending`; `reset` goes to `idle`.
- [ ] **Step 3: Implement the hook and components.**
  - `usePrefersReducedMotion`: `useSyncExternalStore` on `matchMedia('(prefers-reduced-motion: reduce)')`; the server snapshot is `false`.
  - `Guestbook`:
    - Hooks: `useState` for confirmed notes and the message length, `useOptimistic` for pending notes, `useActionState(submitNote, { status: 'idle' })` for the form, `useReducer(journeyReducer, initialJourneyState)`, `useId` for labels, and `useRef` for resetting the form.
    - Inside the action:
      1. Dispatch `send`, call `addOptimistic` (id prefix `pending-`), and record `t0 = performance.now()`.
      2. `fetch('/api/guestbook', …)`.
      3. On success, dispatch `succeed` with `clientTotalMs`, add the note via `startTransition(() => setNotes(…))` (React 19: updates after `await` need their own transition), and reset the form.
      4. On an error response, dispatch `fail` with `stage ?? 'express'` and the API message.
      5. If fetch throws, dispatch `fail` at `browser` with "Couldn't reach the server — check your connection."
    - Form: inputs carry `maxLength={GUESTBOOK_LIMITS.nameMax}` and `maxLength={GUESTBOOK_LIMITS.messageMax}`, `required`, and a live character counter.
    - Honeypot: an `<input name="website">` that is visually hidden, `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`.
    - Notes list shows the newest first, with relative dates; pending notes appear dimmed with "sending…".
  - `RequestJourney`:
    - An ordered list of `STAGES`.
    - While sending, a "packet" pulse travels along the list (CSS keyframes; skipped when reduced motion is on).
    - When done, each stage shows its ms with a staggered reveal (`style={{ '--i': index }}`), and the `express` stage gets a "woke from zero" badge when `coldStart` is true.
    - When failed, the failing stage is styled as an error and shows the message.
    - An `aria-live="polite"` sentence: "Your note travelled through 5 layers in {totalMs} ms." On narrow screens the stages stack vertically.
  - Registry entry `guestbook`:
    - layers `['HTML', 'CSS', 'TypeScript', 'React', 'Next.js', 'Vercel', 'Node.js', 'Express', 'GCP Cloud Run', 'PostgreSQL']`
    - hooks `['useState', 'useOptimistic', 'useActionState', 'useReducer', 'useId', 'useRef', 'useSyncExternalStore']`
    - nextFeatures `['Route Handlers', 'Backend-for-frontend proxy']`
    - files: `Guestbook.tsx`, `RequestJourney.tsx`, `usePrefersReducedMotion.ts`, `api/guestbook/route.ts`, `backend/src/guestbook/guestbook.routes.ts`, `backend/migrations/001_init.sql`
- [ ] **Laptop:** `npm test`. Expected: all frontend tests pass, including the registry honesty test.

---

### Task 10: Project search

**Files:**
- Create: `frontend/src/hooks/useDebouncedValue.ts`, `frontend/src/hooks/useProjectSearch.ts`, `frontend/src/components/ProjectSearch/ProjectSearch.tsx` + `.module.css`
- Modify: `frontend/src/xray/registry.ts` (add the `projects` entry)
- Test: `src/hooks/useDebouncedValue.test.ts`, `src/hooks/useProjectSearch.test.ts`

**Interfaces:**
- Consumes: `GET /api/projects` (Task 8); `Section` (Task 7); `Project`, `SearchProjectsResponse` (Task 6).
- Produces:
  - `useDebouncedValue<T>(value: T, delayMs: number): T`
  - `SEARCH_DEBOUNCE_MS = 250`
  - `SearchState = { status: 'idle' | 'loading' | 'success' | 'error'; projects: Project[]; timings: RelayTimings | null; error: string | null }`
  - `useProjectSearch(query: string, initialProjects: Project[]): SearchState`
  - `ProjectSearch({ initialProjects, backendAvailable }: { initialProjects: Project[]; backendAvailable: boolean })`

- [ ] **Step 1: Write the failing tests** (`vi.useFakeTimers()`, `renderHook`).

```ts
it('updates only after the delay', ...);                         // 'a' → 'ab' at 100ms → still 'a' at 249ms → 'ab' at 250ms
it('returns initial projects for an empty query without fetching', ...);
it('aborts the previous request and keeps only the latest results', ...);
  // query 're' → +250ms → fetch #1 (resolves at +500ms with [A]); query 'react' → +250ms → fetch #2 (resolves at +50ms with [B])
  // expect fetch #1's signal.aborted === true; after all timers: projects === [B], status 'success'
it('reports an error state on a failed response', ...);          // 502 → status 'error', previous projects kept
```

- [ ] **Step 2: Implement.**
  - `useProjectSearch`:
    - Debounce `query.trim()`.
    - An empty debounced query gives a derived idle state with `initialProjects`; no effect and no fetch.
    - Otherwise a `useEffect` creates an `AbortController`, sets `loading` while keeping the current projects (no flicker), and calls `fetch('/api/projects?q=' + encodeURIComponent(q), { signal })`.
    - It ignores `AbortError` and aborts in the cleanup.
  - `ProjectSearch`:
    - `useState` for the query, `useId` for the label, and a `type="search"` input.
    - Status line, e.g. "4 results · PostgreSQL answered in 3 ms (total 180 ms)", using `timings.dbMs` and `timings.nextTotalMs`.
    - Result cards: title, year, summary, tech chips and repo/live links.
    - An empty state: "No projects match “{q}”"; an error state with a retry hint; a waking-up notice when `backendAvailable` is false.
  - Registry entry `projects`:
    - layers `['React', 'Next.js', 'Express', 'PostgreSQL', 'GCP Cloud Run']`
    - hooks `['useState', 'useEffect', 'useId']`
    - nextFeatures `['Route Handlers', 'Incremental Static Regeneration (initial list)']`
    - files: `ProjectSearch.tsx`, `useProjectSearch.ts`, `useDebouncedValue.ts`, `api/projects/route.ts`, `backend/src/lib/tsquery.ts`, `backend/src/projects/projects.repository.ts`, `backend/migrations/001_init.sql`
  - The honesty test requires each hook to appear in at least one listed file.
- [ ] **Laptop:** `npm test`. Expected: all pass.

---

### Task 11: Page assembly (hero, stack, footer, OG image)

**Files:**
- Create: `frontend/src/components/Hero/Hero.tsx`, `StackSection/StackSection.tsx`, `SiteFooter/SiteFooter.tsx` (each with a `.module.css`), `frontend/src/app/opengraph-image.tsx`
- Modify: `frontend/src/app/page.tsx` (replace the placeholder)
- Test: `src/components/StackSection/StackSection.test.tsx`
- The `stack` section's X-ray entry is added in Task 12, because it points at the workflow files created there. Until then `XrayPanel` renders nothing for that section.

**Interfaces:**
- Consumes: `getNotes`, `getProjects`, `site` (Task 6); `Section`, `XrayToggle` (Task 7); `Guestbook` (Task 9); `ProjectSearch` (Task 10).
- Produces:
  - `page.tsx`, an async Server Component with `export const revalidate = 60`. It calls `Promise.all([getNotes(), getProjects()])`, and `backendAvailable` is false when either result is `null`.
  - `STACK_SKILLS: ReadonlyArray<{ name: string; proof: string; href: string }>`, exported from `StackSection.tsx`.

- [ ] **Step 1: Write the failing test.**

```ts
it('links every skill to proof on the page or in the repo', ...);  // each href starts with '#' or site.repoUrl
it('lists Java, MySQL and AWS only under "Also worked with"', ...); // the "Also worked with" element contains all three; none appears in a STACK_SKILLS name
```

- [ ] **Step 2: Implement.**
  - `Hero`: `site.name`, `site.role`, the line "Don't read about my skills — switch on X-ray and watch them run.", an `XrayToggle`, and a "Leave a note" link to `#guestbook`.
  - `STACK_SKILLS` covers HTML, CSS, JavaScript/TypeScript, React, Next.js, Node.js, Express, PostgreSQL, GCP Cloud Run, Vercel and GitHub Actions. Each has a one-line `proof` and an `href`: a section anchor, or `githubFileUrl(...)` for workflows.
  - "Also worked with: Java · MySQL · AWS" is rendered from `site.alsoWorkedWith`.
  - `SiteFooter`: email, GitHub, LinkedIn, a "Source code" link to `site.repoUrl`, and the year.
  - Page order:
    1. `Section hero`
    2. `Section guestbook` "Leave a note — and watch where it goes"
    3. `Section projects` "Work"
    4. `Section stack` "Stack"
    5. Footer
    - `<main id="main">` wraps the sections.
  - `opengraph-image.tsx`: `ImageResponse` from `next/og`, `size = { width: 1200, height: 630 }`, `contentType = 'image/png'`, showing name, role and "Switch on X-ray". Use the default font so nothing is fetched.
- [ ] **Laptop:** `npm test && npm run build && npm start`, with `BACKEND_URL` pointing at the local backend. Check the page renders, X-ray toggles with the button and with `x`, posting a note animates the journey, and search returns results. Repeat with the backend stopped: the page still renders with waking-up notices.

---

### Task 12: CI/CD workflows and documentation

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy-backend.yml`, `README.md`, `DEPLOYMENT.md`
- Modify: `frontend/src/xray/registry.ts`, adding the `stack` entry:
  - layers `['GitHub Actions', 'GCP Cloud Run', 'Vercel', 'Node.js']`
  - hooks `[]`
  - nextFeatures `['Server Components (no client JS for this section)']`
  - files `.github/workflows/ci.yml`, `.github/workflows/deploy-backend.yml`, `backend/Dockerfile`

**Interfaces:**
- Consumes: npm scripts from Tasks 1 and 6; GCP names from Global Constraints.
- Produces:
  - GitHub repository variables `GCP_PROJECT_ID` and `GCP_REGION`.
  - GitHub secrets `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA` and `DATABASE_URL`.
  - Vercel env vars `BACKEND_URL` and `INTERNAL_API_KEY`.

- [ ] **Step 1: Write `ci.yml`.**
  - Runs on `push` to `main` and on `pull_request`, with `concurrency: ci-${{ github.ref }}` and `cancel-in-progress: true`.
  - Job `backend` (working directory `backend`): `actions/checkout@v5`, then `actions/setup-node@v5` with `node-version: 24`, `cache: npm` and `cache-dependency-path: backend/package-lock.json`, then `npm ci`, `npm run typecheck`, `npm test` and `npm run build`.
  - Job `frontend`: the same, plus `npm run lint`. The build runs without `BACKEND_URL` on purpose, which proves the build-time fallback.
- [ ] **Step 2: Write `deploy-backend.yml`.**
  - Triggers: `push` to `main` on paths `backend/**` and the workflow file, plus `workflow_dispatch`.
  - `concurrency: deploy-backend`, `cancel-in-progress: false`; `permissions: { contents: read, id-token: write }`.
  - Env: `IMAGE = ${REGION}-docker.pkg.dev/${PROJECT_ID}/portfolio/portfolio-api:${{ github.sha }}`.
  - Job `test`: same as the CI backend job.
  - Job `deploy` (`needs: test`), in order:
    1. Checkout, setup-node and `npm ci` in `backend`.
    2. `google-github-actions/auth@v2` with `workload_identity_provider` and `service_account` from secrets.
    3. `google-github-actions/setup-gcloud@v2`.
    4. `gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet`.
    5. `docker build -t "$IMAGE" backend`, then `docker push "$IMAGE"`.
    6. `npm run migrate` and `npm run seed`, with `DATABASE_URL` from secrets.
    7. `gcloud run deploy portfolio-api --image="$IMAGE" --region="$REGION" --service-account=portfolio-api-runtime@${PROJECT_ID}.iam.gserviceaccount.com --set-secrets=DATABASE_URL=portfolio-database-url:latest,INTERNAL_API_KEY=portfolio-internal-api-key:latest,IP_HASH_SALT=portfolio-ip-hash-salt:latest --set-env-vars=NODE_ENV=production --allow-unauthenticated --min-instances=0 --max-instances=2 --memory=512Mi --cpu=1 --concurrency=80 --timeout=30`.
    8. Smoke test: read the URL with `gcloud run services describe … --format='value(status.url)'`, then `curl -fsS "$URL/health"`.
  - Comment why `--allow-unauthenticated` is safe here: `/v1` requires the internal key, and `/health` exposes nothing.
- [ ] **Step 3: Write `DEPLOYMENT.md`, numbered steps written for someone doing this for the first time, with exact commands and placeholders `PROJECT_ID`, `PROJECT_NUMBER`, `GITHUB_OWNER/REPO`.**
  0. **Accounts and tools:** GitHub, Google Cloud (billing account and card), Neon, Vercel; Node 24, gcloud CLI, Docker optional.
  1. **First laptop run:** clone, then `npm install` in `backend/` and `frontend/` (this creates the lockfiles); run tests, lint and typecheck; commit and push the lockfiles. CI needs them.
  2. **Fill in content:** `site.ts` and `projects.json`.
  3. **Neon:**
     - Create a project in AWS US East (Ohio).
     - Copy the **pooled** connection string; change `sslmode=require` to `sslmode=verify-full` and drop `channel_binding`.
  4. **Run locally:**
     - Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
     - Backend: `.env`, then `npm run migrate`, `npm run seed`, `npm run dev`.
     - Frontend: `.env.local` with `BACKEND_URL=http://localhost:8080`, then `npm run dev`.
  5. **GCP setup:**
     - Create the project, link billing, and set a $1 budget alert (console steps).
     - Enable `run`, `artifactregistry`, `secretmanager`, `iamcredentials` and `sts`.
     - Create the Artifact Registry repo `portfolio` with a keep-3-newest cleanup policy (`gcloud artifacts repositories set-cleanup-policies` with a policy JSON).
     - Create the three secrets.
     - Runtime SA `portfolio-api-runtime` with `roles/secretmanager.secretAccessor`.
     - Deploy SA `portfolio-deployer` with `roles/run.admin`, `roles/artifactregistry.writer`, and `roles/iam.serviceAccountUser` on the runtime SA.
     - Workload Identity pool `github` and OIDC provider `github-oidc` (issuer `https://token.actions.githubusercontent.com`), with attribute mapping `google.subject=assertion.sub,attribute.repository=assertion.repository` and condition `assertion.repository=='GITHUB_OWNER/REPO'`.
     - Grant `roles/iam.workloadIdentityUser` on the deploy SA to `principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/GITHUB_OWNER/REPO`.
  6. **GitHub settings:** add the variables and secrets listed in Interfaces.
  7. **First deploy:** run "Deploy backend" from the Actions tab and copy the Cloud Run URL.
  8. **Vercel:** import the repo, set Root Directory `frontend`, add the env vars, deploy, then set `site.siteUrl` to the live URL and push.
  9. **Moderation:** hide a note in the Neon SQL editor with `UPDATE guestbook_notes SET is_hidden = true WHERE id = …;`.
  10. **Costs:** recap of the guardrails and what each free allowance covers.
  11. **Troubleshooting:** 502 on the first visit means a cold start, so retry; 401 in logs means a key mismatch between Vercel and Secret Manager; `npm ci` failing means the lockfile wasn't committed.
  12. **Laptop checklist** (what automated tests don't cover):
      - The real SQL against Neon, including search ranking and prefix search.
      - Cold-start badge after 15+ minutes idle.
      - Mobile layout at 375px, reduced motion, keyboard-only use, every X-ray link opening the right GitHub file.
- [ ] **Step 4: Write `README.md`.**
  - What this is and the X-ray idea.
  - An architecture diagram (Mermaid) of browser → Vercel/Next.js → Cloud Run/Express → Neon.
  - Repo layout, the scripts in each app, and a link to DEPLOYMENT.md.
  - A "How to read this code" path:
    1. `frontend/src/app/page.tsx`
    2. `Guestbook.tsx`
    3. `api/guestbook/route.ts`
    4. `lib/relay.ts`
    5. `backend/src/app.ts`
    6. `guestbook.routes.ts`
    7. `001_init.sql`
- [ ] **Laptop:** `npm test` in `frontend` (the registry honesty test now finds the workflow files). Push to `main`; CI goes green; after the GCP and GitHub setup, "Deploy backend" goes green and the smoke test passes.

---

### Task 13: Final review and single push to GitHub

**Files:** none new.

- [ ] **Step 1: Whole-repo static review.**
  - The shared type block in `backend/src/types.ts` matches `frontend/src/lib/api-types.ts` exactly, and `GUESTBOOK_LIMITS` is the same in both apps.
  - Every import resolves to an export with the names in the Interfaces blocks.
  - Every file has its header comment.
  - No `.env` files, secrets or lockfiles are present; `.gitignore` covers build output.
- [ ] **Step 2: Ask the user for the GitHub repository URL.** Confirm whether the repo is empty. If the remote already has commits (for example a README created on github.com), stop and ask before going further. Never force-push.
- [ ] **Step 3: Push.**
  1. `git init -b main` and `git remote add origin <url>`.
  2. Stage with explicit paths: `git add -- .gitattributes .gitignore .editorconfig README.md DEPLOYMENT.md .github backend frontend docs`.
  3. Commit `"feat: full-stack portfolio with X-ray mode and request journey"`, ending the message with the Co-Authored-By trailer.
  4. `git push -u origin main`.
- [ ] **Step 4: Report to the user.** What was pushed, that nothing was run here, and the first three laptop commands (DEPLOYMENT.md step 1).
