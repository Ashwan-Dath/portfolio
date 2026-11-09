# Full-stack portfolio

A portfolio that proves full-stack skills by running them. Recruiters see a polished site. Switch on **X-ray** (the button, or press `X`) and the page turns into a blueprint that labels every part and shows which React hooks, Next.js features and files power it. Leave a guestbook note and a timing chart traces it through every layer: browser, Next.js, network, Express and PostgreSQL.

## What's in this repo

```
frontend/   Next.js 16 site (App Router, React 19, TypeScript, CSS Modules). Deployed by Vercel.
backend/    Express API + PostgreSQL. Not built yet; the frontend runs in demo mode until it is.
docs/       The build plan and design previews.
```

### Demo mode

When `BACKEND_URL` is not set, the site runs in **demo mode**: it uses the sample notes and projects in `frontend/src/content/demo-data.ts`, and the route handlers simulate the API's timings (the page says so wherever those numbers appear). Notes are not saved in demo mode. Once the Express API exists, set `BACKEND_URL` and `INTERNAL_API_KEY` and everything switches to the real backend.

## Run the frontend on your laptop

You need Node.js 24 (`node --version` should print v24.x).

```bash
cd frontend
npm install          # first time only; this also creates package-lock.json (commit it)
npm run dev          # start the site at http://localhost:3000 (demo mode)
```

Checks to run before pushing:

```bash
npm test             # unit tests (Vitest), run once
npm run lint         # ESLint
npm run typecheck    # generates Next.js types, then runs TypeScript
npm run build        # production build, exactly what Vercel will run
```

Other scripts:

```bash
npm start            # serve the production build from `npm run build` (http://localhost:3000)
npm run test:watch   # re-run the tests automatically every time you save a file
```

## Make it yours

| What | Where |
|---|---|
| Name, role, email, GitHub, LinkedIn, repo URL, live URL | `frontend/src/content/site.ts` |
| Projects and sample notes (demo mode) | `frontend/src/content/demo-data.ts` |
| What the chat assistant knows about you (summary, skills, experience) | `frontend/src/content/profile.ts` |
| Colours, fonts, spacing, X-ray theme | `frontend/src/app/globals.css` (tokens at the top) |
| What X-ray says about each part | `frontend/src/xray/registry.ts` |

`repoUrl` matters: X-ray's "Code" links point at files in that repository on the `main` branch.

## Deploy the frontend on Vercel (free)

1. Push this repo to GitHub.
2. On vercel.com, choose **Add New > Project** and import the repository.
3. Set **Root Directory** to `frontend`. Vercel detects Next.js automatically.
4. Leave the environment variables empty for now (demo mode), then click **Deploy**.
5. Copy the live URL into `site.siteUrl` in `frontend/src/content/site.ts` and push again.

Every push to `main` now redeploys automatically.

## How to read the code

Start at the page and follow a guestbook note:

1. `frontend/src/app/page.tsx`: loads notes and projects on the server, lays out the page.
2. `frontend/src/components/Guestbook/Guestbook.tsx`: the form, `useActionState`, `useOptimistic`.
3. `frontend/src/app/api/guestbook/route.ts`: the Next.js route handler the browser calls.
4. `frontend/src/lib/relay.ts`: forwards to the API and merges the timings (or `lib/demo.ts` in demo mode).
5. `frontend/src/lib/journey.ts`: turns the timings into one number per layer and the chart layout.
6. `frontend/src/components/RequestJourney/RequestJourney.tsx`: draws the timing chart.
7. `frontend/src/xray/`: X-ray mode (state, switch, panels, and the registry its honesty test checks).

Every file starts with a comment saying what it is for and who uses it.
