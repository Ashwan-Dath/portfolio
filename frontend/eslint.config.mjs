// eslint.config.mjs
// Lint rules (ESLint "flat config" format, the default since Next.js 16).
// `npm run lint` checks the code for bugs and React/Next.js mistakes before they reach the browser.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  // Next.js rules, including the React hooks rules and checks that protect Core Web Vitals (page speed).
  ...nextVitals,
  // TypeScript-aware versions of the rules.
  ...nextTs,
  // Generated or build output: never lint these.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
]);
